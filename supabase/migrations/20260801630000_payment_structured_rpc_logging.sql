-- Payment Task 83: structured RAISE LOG conventions for payment RPCs (design.md §10.2).

create or replace function public.payment_build_log_payload(
  p_event text,
  p_service_id uuid default null,
  p_schedule_id uuid default null,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'domain', 'payment',
      'event', nullif(btrim(p_event), ''),
      'service_id', p_service_id,
      'schedule_id', p_schedule_id
    ) || coalesce(p_context, '{}'::jsonb)
  );
$$;

comment on function public.payment_build_log_payload(text, uuid, uuid, jsonb) is
  'Pure helper: canonical JSON payload for payment RPC structured logs (§10.2).';

create or replace function public.payment_raise_log(
  p_event text,
  p_service_id uuid default null,
  p_schedule_id uuid default null,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  if nullif(btrim(p_event), '') is null then
    return;
  end if;

  v_payload := public.payment_build_log_payload(
    p_event,
    p_service_id,
    p_schedule_id,
    p_context
  );

  raise log 'payment %', v_payload::text;
end;
$$;

comment on function public.payment_raise_log(text, uuid, uuid, jsonb) is
  'Internal structured log emitter for payment RPCs; correlates via service_id and schedule_id.';

revoke all on function public.payment_build_log_payload(text, uuid, uuid, jsonb) from public;
revoke all on function public.payment_raise_log(text, uuid, uuid, jsonb) from public;
revoke all on function public.payment_raise_log(text, uuid, uuid, jsonb) from anon;
revoke all on function public.payment_raise_log(text, uuid, uuid, jsonb) from authenticated;
revoke all on function public.payment_raise_log(text, uuid, uuid, jsonb) from service_role;

-- payment_claim_charge_batch: per-row charge_attempt_started log after audit.
create or replace function public.payment_claim_charge_batch(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_lease_minutes int;
  v_max_attempts int;
  v_rows jsonb := '[]'::jsonb;
  v_claimed record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_claim_charge_batch'
      using errcode = '42501';
  end if;

  v_batch_size := coalesce(
    p_batch_size,
    public.platform_constant_int('charge_batch_size', 10)
  );
  v_lease_minutes := public.platform_constant_int('payment_lease_duration_minutes', 10);
  v_max_attempts := public.platform_constant_int('max_charge_attempts', 3);

  create temp table _payment_claim_batch_result on commit drop as
  with eligible as materialized (
    select
      ps.id,
      ps.state as from_state,
      ps.contracted_service_id,
      ps.client_id,
      ps.provider_id,
      ps.gateway_slug,
      ps.client_card_token_id,
      ps.installment_number,
      ps.base_amount,
      ps.automatic_attempt_count,
      ps.max_attempts,
      ps.clearsale_session_id,
      ps.client_ip_address,
      public.payment_total_with_card_fees(
        ps.base_amount,
        cct.card_brand,
        ps.installment_number
      ) as charge_amount
    from public.payment_schedules ps
    join public.contracted_services cs on cs.id = ps.contracted_service_id
    join public.client_card_tokens cct
      on cct.id = ps.client_card_token_id
     and cct.state = 'ACTIVE'::public.payment_client_card_token_state
     and cct.client_id = ps.client_id
     and not public.payment_client_card_token_is_expired(cct.expiry_month, cct.expiry_year)
    join public.provider_gateway_accounts pga
      on pga.provider_id = ps.provider_id
     and pga.gateway_slug = ps.gateway_slug
     and pga.onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status
    where ps.state in ('SCHEDULED', 'FAILED')
      and ps.automatic_attempt_count < v_max_attempts
      and ps.charge_scheduled_at <= now()
      and (ps.locked_until is null or ps.locked_until < now())
      and (ps.next_retry_at is null or ps.next_retry_at <= now())
      and cs.status not in ('CANCELLED', 'COMPLETED')
    order by ps.charge_scheduled_at
    limit v_batch_size
    for update of ps skip locked
  ),
  claimed as (
    update public.payment_schedules ps
    set
      state = 'PROCESSING',
      locked_until = now() + make_interval(mins => v_lease_minutes),
      automatic_attempt_count = ps.automatic_attempt_count + 1,
      updated_at = now()
    from eligible e
    where ps.id = e.id
    returning
      ps.id,
      e.contracted_service_id,
      e.client_id,
      e.provider_id,
      e.gateway_slug,
      e.client_card_token_id,
      e.installment_number,
      e.base_amount,
      ps.automatic_attempt_count,
      e.max_attempts,
      e.clearsale_session_id,
      e.client_ip_address,
      e.from_state,
      e.charge_amount
  )
  select * from claimed;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  into v_rows
  from _payment_claim_batch_result t;

  for v_claimed in select * from _payment_claim_batch_result loop
    perform public.payment_write_audit(
      p_event_type := 'CHARGE_ATTEMPT_STARTED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_claimed.id,
      p_service_id := v_claimed.contracted_service_id,
      p_schedule_id := v_claimed.id,
      p_from_state := v_claimed.from_state::text,
      p_to_state := 'PROCESSING',
      p_actor := 'cron'::public.payment_audit_actor,
      p_metadata := jsonb_build_object(
        'automatic_attempt_count', v_claimed.automatic_attempt_count,
        'charge_amount', v_claimed.charge_amount
      )
    );

    perform public.payment_raise_log(
      'charge_attempt_started',
      v_claimed.contracted_service_id,
      v_claimed.id,
      jsonb_build_object(
        'gateway_slug', v_claimed.gateway_slug,
        'attempt_number', v_claimed.automatic_attempt_count,
        'charge_amount', v_claimed.charge_amount,
        'initiator', 'cron'
      )
    );
  end loop;

  return v_rows;
end;
$$;

-- payment_commit_charge_outcome: log committed outcome with correlation IDs.
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

  perform public.payment_raise_log(
    'charge_outcome_committed',
    v_schedule.contracted_service_id,
    v_schedule.id,
    jsonb_build_object(
      'outcome', v_effective_outcome,
      'from_state', v_from_state,
      'initiator', v_initiator::text,
      'charge_amount', v_expected_charge_amount,
      'attempt_number', v_attempt_number,
      'automatic_attempt_count', v_attempt_count,
      'gateway_slug', v_schedule.gateway_slug,
      'gateway_latency_ms', p_gateway_latency_ms,
      'failure_code', p_failure_code,
      'reconciled', v_reconciling
    )
  );

  return v_schedule.id;
end;
$$;

-- payment_begin_manual_attempt: log manual payment initiation.
create or replace function public.payment_begin_manual_attempt(
  p_schedule_id uuid,
  p_client_id uuid,
  p_clearsale_session_id text,
  p_client_ip_address text default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_service public.contracted_services%rowtype;
  v_cancel_hours int;
  v_lease_minutes int;
  v_from_state text;
  v_exec_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_begin_manual_attempt'
      using errcode = '42501';
  end if;

  if p_clearsale_session_id is null or btrim(p_clearsale_session_id) = '' then
    raise exception 'CLEARSALE_SESSION_REQUIRED'
      using errcode = 'P0001';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id
    and ps.client_id = p_client_id
  for update skip locked;

  if not found then
    if exists (
      select 1
      from public.payment_schedules ps
      where ps.id = p_schedule_id
        and ps.client_id = p_client_id
    ) then
      raise exception 'PAYMENT_ALREADY_IN_PROGRESS'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'PAYMENT_ALREADY_IN_PROGRESS')::text;
    end if;

    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select cs.*
  into v_service
  from public.contracted_services cs
  where cs.id = v_schedule.contracted_service_id;

  if not found or v_service.client_id <> p_client_id then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_service.status = 'CANCELLED'::public.contracted_service_status then
    raise exception 'SERVICE_CANCELLED'
      using errcode = 'P0001';
  end if;

  if v_schedule.state not in ('FAILED', 'FAILED_PERMANENT') then
    raise exception 'INVALID_SCHEDULE_STATE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'INVALID_SCHEDULE_STATE')::text;
  end if;

  v_exec_at := public.payment_service_execution_at(v_service);
  v_cancel_hours := public.platform_constant_int('auto_cancel_hours_before_service', 12);

  if v_exec_at - now() <= make_interval(hours => v_cancel_hours) then
    raise exception 'SERVICE_AUTO_CANCELLED'
      using errcode = 'P0001';
  end if;

  if v_schedule.client_card_token_id is not null
    and not exists (
      select 1
      from public.client_card_tokens cct
      where cct.id = v_schedule.client_card_token_id
        and cct.client_id = p_client_id
        and cct.state = 'ACTIVE'::public.payment_client_card_token_state
        and not public.payment_client_card_token_is_expired(cct.expiry_month, cct.expiry_year)
    ) then
    raise exception 'PAYMENT_TOKEN_INACTIVE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PAYMENT_TOKEN_INACTIVE')::text;
  end if;

  v_lease_minutes := public.platform_constant_int('payment_lease_duration_minutes', 10);
  v_from_state := v_schedule.state;

  update public.payment_schedules ps
  set
    state = 'PROCESSING',
    locked_until = now() + make_interval(mins => v_lease_minutes),
    manual_attempt_count = ps.manual_attempt_count + 1,
    clearsale_session_id = trim(p_clearsale_session_id),
    client_ip_address = nullif(trim(coalesce(p_client_ip_address, '')), ''),
    updated_at = now()
  where ps.id = v_schedule.id
  returning * into v_schedule;

  perform public.payment_write_audit(
    p_event_type := 'MANUAL_PAYMENT_INITIATED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_from_state,
    p_to_state := 'PROCESSING',
    p_actor := 'client',
    p_actor_id := coalesce(p_actor_id, p_client_id),
    p_metadata := jsonb_build_object(
      'clearsale_session_id', trim(p_clearsale_session_id),
      'manual_attempt_count', v_schedule.manual_attempt_count
    )
  );

  perform public.payment_raise_log(
    'manual_payment_initiated',
    v_schedule.contracted_service_id,
    v_schedule.id,
    jsonb_build_object(
      'gateway_slug', v_schedule.gateway_slug,
      'manual_attempt_count', v_schedule.manual_attempt_count,
      'initiator', 'client'
    )
  );

  return jsonb_build_object(
    'id', v_schedule.id,
    'contracted_service_id', v_schedule.contracted_service_id,
    'client_id', v_schedule.client_id,
    'provider_id', v_schedule.provider_id,
    'gateway_slug', v_schedule.gateway_slug,
    'client_card_token_id', v_schedule.client_card_token_id,
    'installment_number', v_schedule.installment_number,
    'base_amount', v_schedule.base_amount,
    'state', v_schedule.state,
    'manual_attempt_count', v_schedule.manual_attempt_count,
    'automatic_attempt_count', v_schedule.automatic_attempt_count,
    'max_attempts', v_schedule.max_attempts,
    'clearsale_session_id', v_schedule.clearsale_session_id,
    'client_ip_address', v_schedule.client_ip_address,
    'charge_amount', public.payment_calculate_charge_amount(
      v_schedule.client_card_token_id,
      v_schedule.base_amount,
      v_schedule.installment_number
    )
  );
end;
$$;

-- payment_recover_orphaned_schedules: per-row orphan_recovered log.
create or replace function public.payment_recover_orphaned_schedules()
returns table (
  recovered_count int,
  recovered_to_scheduled int,
  recovered_to_failed int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_sched int := 0;
  v_fail int := 0;
  v_retry_minutes int;
  v_updated record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_recover_orphaned_schedules'
      using errcode = '42501';
  end if;

  v_retry_minutes := public.platform_constant_int('charge_retry_interval_minutes', 30);

  create temp table _payment_orphan_recovery_result on commit drop as
  with orphans as (
    select ps.*
    from public.payment_schedules ps
    where ps.state = 'PROCESSING'::public.payment_schedule_state
      and ps.locked_until is not null
      and ps.locked_until < now()
    for update skip locked
  ),
  resolved as (
    select
      o.*,
      exists (
        select 1
        from public.payment_attempts pa
        where pa.schedule_id = o.id
          and pa.attempt_number = o.automatic_attempt_count
          and pa.initiator = 'cron'::public.payment_attempt_initiator
      ) as has_attempt_row,
      case
        when o.gateway_charge_id is not null then 'IN_ANALYSIS'::public.payment_schedule_state
        -- Ambiguous manual timeout: hold for getTransaction reconcile (do not FAILED→rotate).
        when o.manual_attempt_count > 0 then 'IN_ANALYSIS'::public.payment_schedule_state
        when o.automatic_attempt_count = 0 then 'SCHEDULED'::public.payment_schedule_state
        when not exists (
          select 1
          from public.payment_attempts pa
          where pa.schedule_id = o.id
            and pa.attempt_number = o.automatic_attempt_count
            and pa.initiator = 'cron'::public.payment_attempt_initiator
        ) then 'IN_ANALYSIS'::public.payment_schedule_state
        else 'FAILED'::public.payment_schedule_state
      end as new_state
    from orphans o
  ),
  updated as (
    update public.payment_schedules ps
    set
      state = r.new_state,
      locked_until = null,
      automatic_attempt_count = case
        when r.new_state = 'SCHEDULED'::public.payment_schedule_state
          and r.manual_attempt_count = 0
          and not r.has_attempt_row
          then greatest(0, ps.automatic_attempt_count - 1)::smallint
        else ps.automatic_attempt_count
      end,
      next_retry_at = case
        when r.new_state = 'FAILED'::public.payment_schedule_state
          and r.manual_attempt_count = 0
          then now() + make_interval(mins => v_retry_minutes)
        else null
      end,
      updated_at = now()
    from resolved r
    where ps.id = r.id
    returning
      ps.id,
      r.contracted_service_id,
      r.new_state,
      r.locked_until,
      ps.automatic_attempt_count,
      r.manual_attempt_count
  )
  select * from updated;

  for v_updated in select * from _payment_orphan_recovery_result loop
    perform public.payment_write_audit(
      p_event_type := 'ORPHAN_RECOVERED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_updated.id,
      p_service_id := v_updated.contracted_service_id,
      p_schedule_id := v_updated.id,
      p_from_state := 'PROCESSING',
      p_to_state := v_updated.new_state::text,
      p_actor := 'system'::public.payment_audit_actor,
      p_metadata := jsonb_build_object(
        'recovered_at', now(),
        'locked_until_was', v_updated.locked_until,
        'automatic_attempt_count', v_updated.automatic_attempt_count,
        'manual_attempt_count', v_updated.manual_attempt_count
      )
    );

    perform public.payment_write_event(
      p_event_type := 'OrphanScheduleRecovered',
      p_aggregate_type := 'payment_schedule',
      p_aggregate_id := v_updated.id,
      p_service_id := v_updated.contracted_service_id,
      p_payload := jsonb_build_object(
        'new_state', v_updated.new_state,
        'automatic_attempt_count', v_updated.automatic_attempt_count,
        'manual_attempt_count', v_updated.manual_attempt_count
      )
    );

    perform public.payment_raise_log(
      'orphan_recovered',
      v_updated.contracted_service_id,
      v_updated.id,
      jsonb_build_object(
        'recovered_to_state', v_updated.new_state,
        'automatic_attempt_count', v_updated.automatic_attempt_count,
        'manual_attempt_count', v_updated.manual_attempt_count
      )
    );
  end loop;

  select
    count(*)::int,
    count(*) filter (
      where new_state = 'SCHEDULED'::public.payment_schedule_state
    )::int,
    count(*) filter (
      where new_state = 'FAILED'::public.payment_schedule_state
    )::int
  into v_count, v_sched, v_fail
  from _payment_orphan_recovery_result;

  return query
  select coalesce(v_count, 0), coalesce(v_sched, 0), coalesce(v_fail, 0);
end;
$$;
