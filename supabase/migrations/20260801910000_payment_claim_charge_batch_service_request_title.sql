-- Payment: include service_request_title in charge batch / manual attempt payloads for NetCred charge metadata.

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
      cs.service_request_id,
      coalesce(nullif(btrim(sr.title), ''), 'Serviço') as service_request_title,
      ps.client_id,
      ps.provider_id,
      ps.gateway_slug,
      ps.client_card_token_id,
      ps.installment_number,
      ps.base_amount,
      ps.provider_payout,
      ps.automatic_attempt_count,
      ps.max_attempts,
      ps.clearsale_session_id,
      ps.client_ip_address,
      ps.gateway_reference_code,
      pga.netcred_company_id,
      public.payment_total_with_card_fees(
        ps.base_amount,
        cct.card_brand,
        ps.installment_number
      ) as charge_amount
    from public.payment_schedules ps
    join public.contracted_services cs on cs.id = ps.contracted_service_id
    join public.service_requests sr on sr.id = cs.service_request_id
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
      and ps.charge_frozen_at is null
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
      e.service_request_id,
      e.service_request_title,
      e.client_id,
      e.provider_id,
      e.gateway_slug,
      e.client_card_token_id,
      e.installment_number,
      e.base_amount,
      e.provider_payout,
      e.netcred_company_id,
      ps.automatic_attempt_count,
      e.max_attempts,
      e.clearsale_session_id,
      e.client_ip_address,
      e.gateway_reference_code,
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

    perform public.payment_write_event(
      p_event_type := 'ChargeAttemptStarted',
      p_aggregate_type := 'payment_schedule',
      p_aggregate_id := v_claimed.id,
      p_service_id := v_claimed.contracted_service_id,
      p_payload := jsonb_build_object(
        'automatic_attempt_count', v_claimed.automatic_attempt_count,
        'charge_amount', v_claimed.charge_amount,
        'gateway_slug', v_claimed.gateway_slug,
        'initiator', 'cron'
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

comment on function public.payment_claim_charge_batch(int) is
  'Cron dequeue: SKIP LOCKED lease, increment automatic_attempt_count, return charge_amount, provider_payout, netcred_company_id, service_request_title per row. Skips charge_frozen_at schedules.';

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
  v_service_request_title text;
  v_cancel_hours int;
  v_lease_minutes int;
  v_from_state text;
  v_exec_at timestamptz;
  v_rate_limit jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_begin_manual_attempt'
      using errcode = '42501';
  end if;

  v_rate_limit := public.platform_check_rate_limit(
    format('manual_charge:%s', p_client_id),
    10
  );

  if not coalesce((v_rate_limit->>'allowed')::boolean, false) then
    raise exception 'RATE_LIMIT_EXCEEDED'
      using errcode = 'P0001';
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

  select coalesce(nullif(btrim(sr.title), ''), 'Serviço')
  into v_service_request_title
  from public.service_requests sr
  where sr.id = v_service.service_request_id;

  if not found then
    v_service_request_title := 'Serviço';
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
    -- Fresh UUID so NetCred accepts a new chargeCreate after a prior REJECTED.
    gateway_reference_code = gen_random_uuid(),
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
      'manual_attempt_count', v_schedule.manual_attempt_count,
      'gateway_reference_code', v_schedule.gateway_reference_code
    )
  );

  perform public.payment_write_event(
    p_event_type := 'ManualPaymentInitiated',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_payload := jsonb_build_object(
      'manual_attempt_count', v_schedule.manual_attempt_count,
      'gateway_slug', v_schedule.gateway_slug,
      'initiator', 'client'
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
    'service_request_id', v_service.service_request_id,
    'service_request_title', v_service_request_title,
    'client_id', v_schedule.client_id,
    'provider_id', v_schedule.provider_id,
    'gateway_slug', v_schedule.gateway_slug,
    'client_card_token_id', v_schedule.client_card_token_id,
    'installment_number', v_schedule.installment_number,
    'base_amount', v_schedule.base_amount,
    'provider_payout', v_schedule.provider_payout,
    'state', v_schedule.state,
    'manual_attempt_count', v_schedule.manual_attempt_count,
    'automatic_attempt_count', v_schedule.automatic_attempt_count,
    'max_attempts', v_schedule.max_attempts,
    'clearsale_session_id', v_schedule.clearsale_session_id,
    'client_ip_address', v_schedule.client_ip_address,
    'gateway_reference_code', v_schedule.gateway_reference_code,
    'charge_amount', public.payment_calculate_charge_amount(
      v_schedule.client_card_token_id,
      v_schedule.base_amount,
      v_schedule.installment_number
    )
  );
end;
$$;

comment on function public.payment_begin_manual_attempt(uuid, uuid, text, text, uuid) is
  'Manual charge lease: rate-limited via platform_rate_limits (10/min per client), T-12h gate, increments manual_attempt_count, returns service_request_title.';
