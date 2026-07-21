-- Payment Task 40: payment_process_reconciliation_outcome RPC (design.md §4.9, Req 20 AC2).

create or replace function public.payment_process_reconciliation_outcome(
  p_schedule_id uuid,
  p_gateway_state text,
  p_paid_amount numeric(12, 2) default null,
  p_refunded_amount numeric(12, 2) default null,
  p_gateway_charge_id text default null,
  p_gateway_transaction_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_from_state text;
  v_to_state text;
  v_audit_event text;
  v_event_type text;
  v_charge_amount numeric(12, 2);
  v_gateway_state text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_process_reconciliation_outcome'
      using errcode = '42501';
  end if;

  if p_schedule_id is null then
    raise exception 'p_schedule_id is required'
      using errcode = '22023';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id
    and ps.state in (
      'IN_ANALYSIS'::public.payment_schedule_state,
      'PROCESSING'::public.payment_schedule_state,
      'REFUND_REQUESTED'::public.payment_schedule_state
    )
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'schedule_not_reconcilable');
  end if;

  v_from_state := v_schedule.state::text;
  v_gateway_state := upper(btrim(coalesce(p_gateway_state, '')));

  if v_gateway_state = '' then
    update public.payment_schedules ps
    set
      reconciliation_failure_count = ps.reconciliation_failure_count + 1,
      locked_until = null,
      updated_at = now()
    where ps.id = v_schedule.id
    returning ps.reconciliation_failure_count into v_schedule.reconciliation_failure_count;

    return jsonb_build_object(
      'applied', false,
      'reason', 'gateway_state_missing',
      'reconciliation_failure_count', v_schedule.reconciliation_failure_count
    );
  end if;

  if v_gateway_state not in (
    'PAID', 'REJECTED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'IN_ANALYSIS'
  ) then
    update public.payment_schedules ps
    set
      reconciliation_failure_count = ps.reconciliation_failure_count + 1,
      locked_until = null,
      updated_at = now()
    where ps.id = v_schedule.id
    returning ps.reconciliation_failure_count into v_schedule.reconciliation_failure_count;

    return jsonb_build_object(
      'applied', false,
      'reason', 'unsupported_gateway_state',
      'gateway_state', v_gateway_state,
      'reconciliation_failure_count', v_schedule.reconciliation_failure_count
    );
  end if;

  if v_gateway_state = 'IN_ANALYSIS'
    and v_from_state = 'IN_ANALYSIS' then
    update public.payment_schedules ps
    set locked_until = null
    where ps.id = v_schedule.id;

    return jsonb_build_object(
      'applied', false,
      'reason', 'still_in_analysis',
      'reconciliation_failure_count', v_schedule.reconciliation_failure_count
    );
  end if;

  if v_gateway_state = 'PAID' then
    if v_from_state not in ('IN_ANALYSIS', 'PROCESSING') then
      update public.payment_schedules ps
      set locked_until = null, updated_at = now()
      where ps.id = v_schedule.id;

      return jsonb_build_object(
        'applied', false,
        'reason', 'invalid_source_state',
        'from_state', v_from_state,
        'gateway_state', v_gateway_state
      );
    end if;

    v_charge_amount := coalesce(
      p_paid_amount,
      v_schedule.paid_amount,
      public.payment_calculate_charge_amount(
        v_schedule.client_card_token_id,
        v_schedule.base_amount,
        v_schedule.installment_number
      )
    );

    update public.payment_schedules ps
    set
      state = 'PAID'::public.payment_schedule_state,
      paid_at = coalesce(ps.paid_at, now()),
      paid_amount = v_charge_amount,
      gateway_charge_id = coalesce(p_gateway_charge_id, ps.gateway_charge_id),
      gateway_transaction_id = coalesce(p_gateway_transaction_id, ps.gateway_transaction_id),
      refund_anchor_execution_at = coalesce(
        ps.refund_anchor_execution_at,
        (
          select public.payment_service_execution_at(cs)
          from public.contracted_services cs
          where cs.id = v_schedule.contracted_service_id
        )
      ),
      locked_until = null,
      next_retry_at = null,
      failure_code = null,
      failure_reason = null,
      reconciliation_failure_count = 0,
      updated_at = now()
    where ps.id = v_schedule.id;

    update public.contracted_services cs
    set status = 'CONFIRMED'::public.contracted_service_status
    where cs.id = v_schedule.contracted_service_id
      and cs.status = 'PENDING_PAYMENT'::public.contracted_service_status;

    v_to_state := 'PAID';
    v_audit_event := 'RECONCILIATION_PAID';
    v_event_type := 'ChargeSucceeded';

    perform public.payment_enqueue_notifications(
      v_schedule.id,
      'CHARGE_SUCCEEDED',
      jsonb_build_object('source', 'reconciliation')
    );
  elsif v_gateway_state = 'REJECTED' then
    if v_from_state not in ('IN_ANALYSIS', 'PROCESSING') then
      update public.payment_schedules ps
      set locked_until = null, updated_at = now()
      where ps.id = v_schedule.id;

      return jsonb_build_object(
        'applied', false,
        'reason', 'invalid_source_state',
        'from_state', v_from_state,
        'gateway_state', v_gateway_state
      );
    end if;

    update public.payment_schedules ps
    set
      state = 'FAILED_PERMANENT'::public.payment_schedule_state,
      failed_at = coalesce(ps.failed_at, now()),
      failed_permanently_at = coalesce(ps.failed_permanently_at, now()),
      locked_until = null,
      next_retry_at = null,
      reconciliation_failure_count = 0,
      updated_at = now()
    where ps.id = v_schedule.id;

    v_to_state := 'FAILED_PERMANENT';
    v_audit_event := 'RECONCILIATION_REJECTED';
    v_event_type := 'ChargePermanentlyFailed';

    perform public.payment_enqueue_notifications(
      v_schedule.id,
      'CHARGE_FAILED_PERMANENT',
      jsonb_build_object('source', 'reconciliation')
    );
  elsif v_gateway_state = 'IN_ANALYSIS' and v_from_state = 'PROCESSING' then
    update public.payment_schedules ps
    set
      state = 'IN_ANALYSIS'::public.payment_schedule_state,
      gateway_charge_id = coalesce(p_gateway_charge_id, ps.gateway_charge_id),
      gateway_transaction_id = coalesce(p_gateway_transaction_id, ps.gateway_transaction_id),
      locked_until = null,
      reconciliation_failure_count = 0,
      updated_at = now()
    where ps.id = v_schedule.id;

    v_to_state := 'IN_ANALYSIS';
    v_audit_event := 'RECONCILIATION_IN_ANALYSIS';
    v_event_type := 'ChargeInAnalysis';

    perform public.payment_enqueue_notifications(
      v_schedule.id,
      'CHARGE_IN_ANALYSIS',
      jsonb_build_object('source', 'reconciliation')
    );
  elsif v_gateway_state in ('REFUNDED', 'PARTIALLY_REFUNDED')
    and v_from_state in ('REFUND_REQUESTED', 'PAID') then
    v_to_state := v_gateway_state;

    update public.payment_schedules ps
    set
      state = v_to_state::public.payment_schedule_state,
      refunded_at = coalesce(ps.refunded_at, now()),
      refunded_amount = coalesce(p_refunded_amount, ps.refunded_amount),
      refund_submit_status = 'CONFIRMED'::public.payment_refund_submit_status,
      locked_until = null,
      reconciliation_failure_count = 0,
      updated_at = now()
    where ps.id = v_schedule.id;

    v_audit_event := case
      when v_gateway_state = 'REFUNDED' then 'RECONCILIATION_REFUNDED'
      else 'RECONCILIATION_PARTIALLY_REFUNDED'
    end;
    v_event_type := 'RefundConfirmed';
  else
    update public.payment_schedules ps
    set locked_until = null, updated_at = now()
    where ps.id = v_schedule.id;

    return jsonb_build_object(
      'applied', false,
      'reason', 'transition_not_applicable',
      'from_state', v_from_state,
      'gateway_state', v_gateway_state
    );
  end if;

  perform public.payment_write_audit(
    p_event_type := v_audit_event,
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_from_state,
    p_to_state := v_to_state,
    p_actor := 'cron'::public.payment_audit_actor,
    p_metadata := jsonb_build_object(
      'gateway_state', v_gateway_state,
      'paid_amount', p_paid_amount,
      'refunded_amount', p_refunded_amount,
      'gateway_charge_id', p_gateway_charge_id,
      'gateway_transaction_id', p_gateway_transaction_id,
      'source', 'reconcile-netcred-payments'
    )
  );

  perform public.payment_write_event(
    p_event_type := v_event_type,
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_payload := jsonb_build_object(
      'from_state', v_from_state,
      'to_state', v_to_state,
      'gateway_state', v_gateway_state,
      'initiator', 'reconciliation'
    )
  );

  return jsonb_build_object(
    'applied', true,
    'schedule_id', v_schedule.id,
    'from_state', v_from_state,
    'to_state', v_to_state,
    'reconciliation_failure_count', 0,
    'service_id', v_schedule.contracted_service_id,
    'client_id', v_schedule.client_id,
    'provider_id', v_schedule.provider_id,
    'installment_number', v_schedule.installment_number,
    'charge_amount', coalesce(p_paid_amount, v_schedule.paid_amount)
  );
end;
$$;

comment on function public.payment_process_reconciliation_outcome(
  uuid, text, numeric, numeric, text, text
) is
  'Applies getTransaction reconciliation outcomes to stale payment schedules (service_role only).';

revoke all on function public.payment_process_reconciliation_outcome(
  uuid, text, numeric, numeric, text, text
) from public;
revoke all on function public.payment_process_reconciliation_outcome(
  uuid, text, numeric, numeric, text, text
) from anon;
revoke all on function public.payment_process_reconciliation_outcome(
  uuid, text, numeric, numeric, text, text
) from authenticated;

grant execute on function public.payment_process_reconciliation_outcome(
  uuid, text, numeric, numeric, text, text
) to service_role;
