-- Payment Task 29: payment_commit_charge_outcome RPC (design.md §4.5.2, §4.6).

create or replace function public.payment_commit_charge_outcome(
  p_schedule_id uuid,
  p_outcome text,
  p_charge_amount numeric,
  p_gateway_charge_id text default null,
  p_gateway_transaction_id text default null,
  p_failure_code text default null,
  p_failure_reason text default null,
  p_gateway_latency_ms int default null,
  p_provider_response_summary jsonb default '{}'::jsonb,
  p_undo_attempt_increment boolean default false,
  p_initiator text default 'cron',
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_retry_minutes int;
  v_max_attempts int;
  v_audit_event text;
  v_event_type text;
  v_attempt_count smallint;
  v_attempt_number smallint;
  v_initiator public.payment_attempt_initiator;
  v_effective_outcome text;
  v_expected_charge_amount numeric;
  v_from_state text;
  v_reconciling boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_commit_charge_outcome'
      using errcode = '42501';
  end if;

  if p_outcome not in ('PAID', 'IN_ANALYSIS', 'FAILED', 'FAILED_PERMANENT') then
    raise exception 'INVALID_OUTCOME'
      using errcode = 'P0001';
  end if;

  begin
    v_initiator := coalesce(p_initiator, 'cron')::public.payment_attempt_initiator;
  exception
    when invalid_text_representation then
      raise exception 'INVALID_INITIATOR'
        using errcode = '22023';
  end;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id
  for update;

  if not found then
    raise exception 'INVALID_SCHEDULE_STATE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'INVALID_SCHEDULE_STATE')::text;
  end if;

  v_expected_charge_amount := public.payment_calculate_charge_amount(
    v_schedule.client_card_token_id,
    v_schedule.base_amount,
    v_schedule.installment_number
  );

  if abs(coalesce(p_charge_amount, 0) - v_expected_charge_amount) > 0.01 then
    raise exception 'CHARGE_AMOUNT_MISMATCH'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'CHARGE_AMOUNT_MISMATCH',
          'expected', v_expected_charge_amount,
          'submitted', p_charge_amount
        )::text;
  end if;

  if p_gateway_charge_id is not null
    and v_schedule.gateway_charge_id is not distinct from p_gateway_charge_id
    and v_schedule.state in (
      'PAID'::public.payment_schedule_state,
      'IN_ANALYSIS'::public.payment_schedule_state
    ) then
    return v_schedule.id;
  end if;

  v_retry_minutes := public.platform_constant_int('charge_retry_interval_minutes', 30);
  v_max_attempts := public.platform_constant_int('max_charge_attempts', 3);
  v_attempt_count := v_schedule.automatic_attempt_count;

  if p_undo_attempt_increment then
    v_attempt_count := greatest(0, v_schedule.automatic_attempt_count - 1)::smallint;
  end if;

  v_attempt_number := case
    when v_initiator = 'client'::public.payment_attempt_initiator then v_schedule.manual_attempt_count
    else v_schedule.automatic_attempt_count
  end;

  if exists (
    select 1
    from public.payment_attempts pa
    where pa.schedule_id = v_schedule.id
      and pa.attempt_number = v_attempt_number
      and pa.initiator = v_initiator
  ) then
    return v_schedule.id;
  end if;

  v_from_state := v_schedule.state::text;

  if v_schedule.state <> 'PROCESSING'::public.payment_schedule_state then
    v_reconciling := p_outcome in ('PAID', 'IN_ANALYSIS', 'FAILED')
      and p_gateway_charge_id is not null
      and v_schedule.state in (
        'FAILED'::public.payment_schedule_state,
        'FAILED_PERMANENT'::public.payment_schedule_state,
        'SCHEDULED'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state
      );

    if not v_reconciling then
      if v_schedule.state in (
        'PAID'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state,
        'FAILED_PERMANENT'::public.payment_schedule_state
      ) then
        return v_schedule.id;
      end if;

      if v_schedule.state = 'IN_ANALYSIS'::public.payment_schedule_state
        and p_outcome = 'IN_ANALYSIS' then
        return v_schedule.id;
      end if;

      raise exception 'INVALID_SCHEDULE_STATE'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'INVALID_SCHEDULE_STATE')::text;
    end if;
  end if;

  v_effective_outcome := p_outcome;
  if p_outcome = 'FAILED'
    and v_initiator = 'cron'::public.payment_attempt_initiator
    and v_attempt_count >= v_max_attempts then
    v_effective_outcome := 'FAILED_PERMANENT';
  end if;

  if v_effective_outcome = 'PAID' then
    if not exists (
      select 1
      from public.contracted_services cs
      where cs.id = v_schedule.contracted_service_id
        and cs.status in (
          'PENDING_PAYMENT'::public.contracted_service_status,
          'CONFIRMED'::public.contracted_service_status
        )
    ) then
      raise exception 'CONTRACTED_SERVICE_NOT_CHARGEABLE'
        using
          errcode = 'P0001',
          detail = jsonb_build_object(
            'code', 'CONTRACTED_SERVICE_NOT_CHARGEABLE',
            'contracted_service_id', v_schedule.contracted_service_id
          )::text;
    end if;

    update public.payment_schedules ps
    set
      state = 'PAID',
      paid_at = now(),
      paid_amount = v_expected_charge_amount,
      gateway_charge_id = p_gateway_charge_id,
      gateway_transaction_id = p_gateway_transaction_id,
      locked_until = null,
      next_retry_at = null,
      failure_code = null,
      failure_reason = null,
      automatic_attempt_count = v_attempt_count,
      updated_at = now()
    where ps.id = v_schedule.id;

    update public.contracted_services cs
    set status = 'CONFIRMED'::public.contracted_service_status
    where cs.id = v_schedule.contracted_service_id
      and cs.status = 'PENDING_PAYMENT'::public.contracted_service_status;

    v_audit_event := 'CHARGE_PAID';
    v_event_type := 'ChargeSucceeded';
  elsif v_effective_outcome = 'IN_ANALYSIS' then
    update public.payment_schedules ps
    set
      state = 'IN_ANALYSIS',
      gateway_charge_id = coalesce(p_gateway_charge_id, ps.gateway_charge_id),
      gateway_transaction_id = coalesce(p_gateway_transaction_id, ps.gateway_transaction_id),
      locked_until = null,
      automatic_attempt_count = v_attempt_count,
      updated_at = now()
    where ps.id = v_schedule.id;

    v_audit_event := 'CHARGE_IN_ANALYSIS';
    v_event_type := 'ChargeInAnalysis';
  elsif v_effective_outcome = 'FAILED_PERMANENT' then
    update public.payment_schedules ps
    set
      state = 'FAILED_PERMANENT',
      failed_at = now(),
      failed_permanently_at = coalesce(ps.failed_permanently_at, now()),
      failure_code = p_failure_code,
      failure_reason = p_failure_reason,
      locked_until = null,
      next_retry_at = null,
      automatic_attempt_count = v_attempt_count,
      updated_at = now()
    where ps.id = v_schedule.id;

    v_audit_event := 'CHARGE_FAILED_PERMANENT';
    v_event_type := 'ChargePermanentlyFailed';
  else
    update public.payment_schedules ps
    set
      state = 'FAILED',
      failed_at = now(),
      failure_code = p_failure_code,
      failure_reason = p_failure_reason,
      locked_until = null,
      next_retry_at = now() + make_interval(mins => v_retry_minutes),
      automatic_attempt_count = v_attempt_count,
      updated_at = now()
    where ps.id = v_schedule.id;

    v_audit_event := 'CHARGE_FAILED';
    v_event_type := 'ChargeFailed';
  end if;

  insert into public.payment_attempts (
    schedule_id,
    attempt_number,
    initiator,
    completed_at,
    outcome,
    provider_response_summary,
    failure_code,
    failure_reason,
    charge_amount,
    gateway_latency_ms
  )
  values (
    v_schedule.id,
    v_attempt_number,
    v_initiator,
    now(),
    case v_effective_outcome
      when 'PAID' then 'PAID'::public.payment_attempt_outcome
      when 'IN_ANALYSIS' then 'IN_ANALYSIS'::public.payment_attempt_outcome
      else 'REJECTED'::public.payment_attempt_outcome
    end,
    coalesce(p_provider_response_summary, '{}'::jsonb),
    p_failure_code,
    p_failure_reason,
    v_expected_charge_amount,
    p_gateway_latency_ms
  );

  perform public.payment_write_audit(
    p_event_type := v_audit_event,
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_from_state,
    p_to_state := v_effective_outcome,
    p_actor := case
      when v_initiator = 'client'::public.payment_attempt_initiator then 'client'
      else 'cron'
    end,
    p_actor_id := p_actor_id,
    p_metadata := jsonb_build_object(
      'charge_amount', v_expected_charge_amount,
      'automatic_attempt_count', v_attempt_count,
      'max_attempts', v_max_attempts,
      'undo_attempt_increment', p_undo_attempt_increment,
      'initiator', v_initiator::text,
      'reconciled', v_reconciling,
      'gateway_charge_id', p_gateway_charge_id
    )
  );

  perform public.payment_write_event(
    p_event_type := v_event_type,
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_payload := jsonb_build_object(
      'outcome', v_effective_outcome,
      'charge_amount', v_expected_charge_amount,
      'initiator', v_initiator::text,
      'reconciled', v_reconciling
    )
  );

  return v_schedule.id;
end;
$$;

comment on function public.payment_commit_charge_outcome(
  uuid, text, numeric, text, text, text, text, int, jsonb, boolean, text, uuid
) is
  'Commits charge gateway outcome: schedule state, contracted_services on PAID, attempts, audit, events.';

revoke all on function public.payment_commit_charge_outcome(
  uuid, text, numeric, text, text, text, text, int, jsonb, boolean, text, uuid
) from public;
revoke all on function public.payment_commit_charge_outcome(
  uuid, text, numeric, text, text, text, text, int, jsonb, boolean, text, uuid
) from anon;
revoke all on function public.payment_commit_charge_outcome(
  uuid, text, numeric, text, text, text, text, int, jsonb, boolean, text, uuid
) from authenticated;

grant execute on function public.payment_commit_charge_outcome(
  uuid, text, numeric, text, text, text, text, int, jsonb, boolean, text, uuid
) to service_role;
