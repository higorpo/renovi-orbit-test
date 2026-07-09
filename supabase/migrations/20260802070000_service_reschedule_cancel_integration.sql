-- Cancel active reschedule requests when contracted service is cancelled.

create or replace function public.payment_pre_charge_cancel(
  p_service_id uuid,
  p_actor_id uuid,
  p_cancellation_reason text default null,
  p_initiator text default 'client'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.contracted_services%rowtype;
  v_schedule public.payment_schedules%rowtype;
  v_reason text;
  v_actor public.payment_audit_actor;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_pre_charge_cancel'
      using errcode = '42501';
  end if;

  if p_initiator not in ('client', 'provider') then
    raise exception 'INVALID_INITIATOR'
      using errcode = 'P0001';
  end if;

  select cs.*
  into v_service
  from public.contracted_services cs
  where cs.id = p_service_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if p_initiator = 'client' and v_service.client_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if p_initiator = 'provider' and v_service.provider_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_service.status = 'COMPLETED'::public.contracted_service_status then
    raise exception 'SERVICE_NOT_CANCELLABLE'
      using errcode = 'P0001';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.contracted_service_id = p_service_id
  for update;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_schedule.state = 'IN_ANALYSIS'::public.payment_schedule_state then
    raise exception 'PAYMENT_IN_ANALYSIS'
      using errcode = 'P0001';
  end if;

  if v_schedule.state not in (
    'SCHEDULED'::public.payment_schedule_state,
    'FAILED'::public.payment_schedule_state,
    'FAILED_PERMANENT'::public.payment_schedule_state
  ) then
    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  v_reason := coalesce(
    nullif(btrim(p_cancellation_reason), ''),
    case p_initiator
      when 'client' then 'CLIENT_INITIATED'
      else 'PROVIDER_INITIATED'
    end
  );

  v_actor := case p_initiator
    when 'client' then 'client'::public.payment_audit_actor
    else 'provider'::public.payment_audit_actor
  end;

  perform public.cns_cancel_active_service_reschedule_requests(p_service_id);

  update public.contracted_services cs
  set
    status = 'CANCELLED'::public.contracted_service_status,
    cancellation_reason = v_reason
  where cs.id = p_service_id;

  update public.payment_schedules ps
  set
    state = 'CANCELLED'::public.payment_schedule_state,
    cancelled_at = now(),
    cancellation_reason = v_reason,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.cns_close_contracted_service_chat(
    p_contracted_service_id := p_service_id,
    p_closed_by_user_id := p_actor_id,
    p_initiator := p_initiator,
    p_cancellation_reason := v_reason,
    p_pre_charge := true
  );

  perform public.payment_write_audit(
    p_event_type := 'PRE_CHARGE_CANCELLED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := p_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_schedule.state::text,
    p_to_state := 'CANCELLED',
    p_actor := v_actor,
    p_actor_id := p_actor_id,
    p_metadata := jsonb_build_object(
      'cancellation_reason', v_reason,
      'initiator', p_initiator
    )
  );

  perform public.payment_write_event(
    p_event_type := 'ServiceAutoCancelled',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := p_service_id,
    p_payload := jsonb_build_object(
      'schedule_id', v_schedule.id,
      'cancellation_reason', v_reason,
      'pre_charge', true
    )
  );

  return v_schedule.id;
end;
$$;

create or replace function public.payment_begin_refund_request(
  p_service_id uuid,
  p_actor_id uuid,
  p_cancellation_reason text default null,
  p_initiator text default 'client'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.contracted_services%rowtype;
  v_schedule public.payment_schedules%rowtype;
  v_reason text;
  v_exec_at timestamptz;
  v_charge_amount numeric(12, 2);
  v_refund jsonb;
  v_refund_amount numeric(12, 2);
  v_penalty_tier text;
  v_actor public.payment_audit_actor;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_begin_refund_request'
      using errcode = '42501';
  end if;

  if p_service_id is null or p_actor_id is null then
    raise exception 'p_service_id and p_actor_id are required'
      using errcode = '22023';
  end if;

  if p_initiator not in ('client', 'provider') then
    raise exception 'INVALID_INITIATOR'
      using errcode = 'P0001';
  end if;

  select cs.*
  into v_service
  from public.contracted_services cs
  where cs.id = p_service_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if p_initiator = 'client' and v_service.client_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if p_initiator = 'provider' and v_service.provider_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_service.status = 'COMPLETED'::public.contracted_service_status then
    raise exception 'SERVICE_NOT_CANCELLABLE'
      using errcode = 'P0001';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.contracted_service_id = p_service_id
    and ps.state = 'PAID'::public.payment_schedule_state
  for update;

  if not found then
    if exists (
      select 1
      from public.payment_schedules ps
      where ps.contracted_service_id = p_service_id
        and ps.state = 'IN_ANALYSIS'::public.payment_schedule_state
    ) then
      raise exception 'PAYMENT_IN_ANALYSIS'
        using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.payment_schedules ps
      where ps.contracted_service_id = p_service_id
        and ps.state = 'REFUND_REQUESTED'::public.payment_schedule_state
    ) then
      select ps.*
      into v_schedule
      from public.payment_schedules ps
      where ps.contracted_service_id = p_service_id
        and ps.state = 'REFUND_REQUESTED'::public.payment_schedule_state
      for update;

      v_reason := coalesce(
        nullif(btrim(v_service.cancellation_reason), ''),
        case p_initiator
          when 'client' then 'CLIENT_INITIATED'
          else 'PROVIDER_INITIATED'
        end
      );

      v_exec_at := public.payment_service_execution_at(v_service);
      v_charge_amount := coalesce(
        v_schedule.paid_amount,
        public.payment_calculate_charge_amount(
          v_schedule.client_card_token_id,
          v_schedule.base_amount,
          v_schedule.installment_number
        )
      );

      v_refund := public.payment_calculate_refund_amount(
        v_charge_amount,
        v_schedule.base_amount,
        v_exec_at,
        p_initiator
      );
      v_penalty_tier := v_refund->>'penalty_tier';

      perform public.cns_close_contracted_service_chat(
        p_contracted_service_id := p_service_id,
        p_closed_by_user_id := p_actor_id,
        p_initiator := p_initiator,
        p_cancellation_reason := v_reason,
        p_refund_tier := v_penalty_tier,
        p_pre_charge := false
      );

      return jsonb_build_object(
        'schedule_id', v_schedule.id,
        'gateway_transaction_id', v_schedule.gateway_transaction_id,
        'paid_amount', v_schedule.paid_amount,
        'base_amount', v_schedule.base_amount,
        'refund_amount', v_schedule.refunded_amount,
        'penalty_tier', v_penalty_tier,
        'already_submitted', true
      );
    end if;

    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  if v_schedule.gateway_transaction_id is null then
    raise exception 'TRANSACTION_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  v_exec_at := public.payment_service_execution_at(v_service);

  v_charge_amount := coalesce(
    v_schedule.paid_amount,
    public.payment_calculate_charge_amount(
      v_schedule.client_card_token_id,
      v_schedule.base_amount,
      v_schedule.installment_number
    )
  );

  v_refund := public.payment_calculate_refund_amount(
    v_charge_amount,
    v_schedule.base_amount,
    v_exec_at,
    p_initiator
  );

  v_refund_amount := (v_refund->>'refund_amount')::numeric(12, 2);
  v_penalty_tier := v_refund->>'penalty_tier';

  v_reason := coalesce(
    nullif(btrim(p_cancellation_reason), ''),
    case p_initiator
      when 'client' then 'CLIENT_INITIATED'
      else 'PROVIDER_INITIATED'
    end
  );

  v_actor := case p_initiator
    when 'client' then 'client'::public.payment_audit_actor
    else 'provider'::public.payment_audit_actor
  end;

  update public.payment_schedules ps
  set
    state = 'REFUND_REQUESTED'::public.payment_schedule_state,
    refunded_amount = v_refund_amount,
    cancellation_reason = v_reason,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.cns_cancel_active_service_reschedule_requests(p_service_id);

  update public.contracted_services cs
  set
    status = 'CANCELLED'::public.contracted_service_status,
    cancellation_reason = v_reason
  where cs.id = p_service_id;

  perform public.cns_close_contracted_service_chat(
    p_contracted_service_id := p_service_id,
    p_closed_by_user_id := p_actor_id,
    p_initiator := p_initiator,
    p_cancellation_reason := v_reason,
    p_refund_tier := v_penalty_tier,
    p_pre_charge := false
  );

  perform public.payment_write_audit(
    p_event_type := 'REFUND_SUBMITTED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := p_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_schedule.state::text,
    p_to_state := 'REFUND_REQUESTED',
    p_actor := v_actor,
    p_actor_id := p_actor_id,
    p_metadata := jsonb_build_object(
      'refund_amount', v_refund_amount,
      'penalty_tier', v_penalty_tier,
      'charge_amount', v_charge_amount,
      'cancellation_reason', v_reason,
      'initiator', p_initiator
    )
  );

  perform public.payment_write_event(
    p_event_type := 'RefundRequested',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := p_service_id,
    p_payload := jsonb_build_object(
      'refund_amount', v_refund_amount,
      'penalty_tier', v_penalty_tier,
      'initiator', p_initiator
    )
  );

  return jsonb_build_object(
    'schedule_id', v_schedule.id,
    'gateway_transaction_id', v_schedule.gateway_transaction_id,
    'paid_amount', v_schedule.paid_amount,
    'base_amount', v_schedule.base_amount,
    'charge_amount', v_charge_amount,
    'refund_amount', v_refund_amount,
    'penalty_tier', v_penalty_tier,
    'already_submitted', false
  );
end;
$$;

create or replace function public.payment_auto_cancel_services(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service record;
  v_cancel_hours int;
  v_batch_size int;
  v_reason text;
  v_last_failure_reason text;
  v_results jsonb := '[]'::jsonb;
  v_errors int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_auto_cancel_services'
      using errcode = '42501';
  end if;

  v_cancel_hours := public.platform_constant_int('auto_cancel_hours_before_service', 12);
  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('auto_cancel_batch_size', 100)
    ),
    1
  );

  for v_service in
    select
      cs.id as service_id,
      cs.client_id,
      cs.provider_id,
      cs.status as service_status,
      ps.id as schedule_id,
      ps.state as schedule_state,
      ps.failure_reason,
      pga.onboarding_status
    from public.contracted_services cs
    inner join public.payment_schedules ps on ps.contracted_service_id = cs.id
    left join public.provider_gateway_accounts pga
      on pga.provider_id = ps.provider_id
      and pga.gateway_slug = ps.gateway_slug
    where cs.service_execution_at <= now() + make_interval(hours => v_cancel_hours)
      and cs.status not in (
        'CANCELLED'::public.contracted_service_status,
        'COMPLETED'::public.contracted_service_status
      )
      and (
        ps.state in (
          'SCHEDULED'::public.payment_schedule_state,
          'FAILED'::public.payment_schedule_state,
          'FAILED_PERMANENT'::public.payment_schedule_state
        )
        or ps.state = 'IN_ANALYSIS'::public.payment_schedule_state
      )
    order by cs.service_execution_at, cs.id
    limit v_batch_size
    for update of cs, ps skip locked
  loop
    begin
      if v_service.service_status = 'CANCELLED'::public.contracted_service_status then
        continue;
      end if;

      v_reason := case
        when v_service.onboarding_status = 'SUSPENDED'::public.payment_provider_onboarding_status
          then 'PROVIDER_SUSPENDED'
        else 'NON_PAYMENT'
      end;

      v_last_failure_reason := v_service.failure_reason;

      perform public.cns_cancel_active_service_reschedule_requests(v_service.service_id);

      update public.contracted_services cs
      set
        status = 'CANCELLED'::public.contracted_service_status,
        cancellation_reason = v_reason
      where cs.id = v_service.service_id;

      update public.payment_schedules ps
      set
        state = 'CANCELLED'::public.payment_schedule_state,
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now()
      where ps.id = v_service.schedule_id;

      perform public.cns_close_contracted_service_chat(
        p_contracted_service_id := v_service.service_id,
        p_closed_by_user_id := null,
        p_initiator := 'system',
        p_cancellation_reason := v_reason,
        p_pre_charge := false
      );

      perform public.payment_write_audit(
        p_event_type := 'AUTO_CANCELLED',
        p_entity_type := 'payment_schedule',
        p_entity_id := v_service.schedule_id,
        p_service_id := v_service.service_id,
        p_schedule_id := v_service.schedule_id,
        p_from_state := v_service.schedule_state::text,
        p_to_state := 'CANCELLED',
        p_actor := 'system'::public.payment_audit_actor,
        p_metadata := jsonb_build_object(
          'cancellation_reason', v_reason,
          'service_status', v_service.service_status::text,
          'last_failure_reason', v_last_failure_reason
        )
      );

      perform public.payment_write_event(
        p_event_type := 'ServiceAutoCancelled',
        p_aggregate_type := 'payment_schedule',
        p_aggregate_id := v_service.schedule_id,
        p_service_id := v_service.service_id,
        p_payload := jsonb_build_object(
          'schedule_id', v_service.schedule_id,
          'cancellation_reason', v_reason,
          'last_failure_reason', v_last_failure_reason,
          'requires_gateway_reconcile',
            v_service.schedule_state = 'IN_ANALYSIS'::public.payment_schedule_state
        )
      );

      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'service_id', v_service.service_id,
          'schedule_id', v_service.schedule_id,
          'client_id', v_service.client_id,
          'provider_id', v_service.provider_id,
          'cancellation_reason', v_reason,
          'last_failure_reason', v_last_failure_reason,
          'schedule_state', v_service.schedule_state,
          'requires_gateway_reconcile',
            v_service.schedule_state = 'IN_ANALYSIS'::public.payment_schedule_state
        )
      );
    exception
      when others then
        v_errors := v_errors + 1;
        raise warning
          'payment_auto_cancel_services row failed service_id=% schedule_id=% sqlstate=% message=%',
          v_service.service_id,
          v_service.schedule_id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'cancelled_count', jsonb_array_length(v_results),
    'cancelled', v_results,
    'errors_count', v_errors
  );
end;
$$;
