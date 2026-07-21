-- Payment Task 85: payment_events emission on domain transitions (design.md §3.10, Req 30.1).

alter table public.payment_events
  drop constraint if exists payment_events_aggregate_type_check;

alter table public.payment_events
  add constraint payment_events_aggregate_type_check
  check (aggregate_type in (
    'payment_schedule',
    'client_card_token',
    'provider_gateway_account',
    'payment_webhook_event'
  ));

comment on column public.payment_events.aggregate_type is
  'Aggregate kind: payment_schedule, client_card_token, provider_gateway_account, payment_webhook_event.';

create or replace function public.payment_write_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_service_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if p_aggregate_type not in (
    'payment_schedule',
    'client_card_token',
    'provider_gateway_account',
    'payment_webhook_event'
  ) then
    raise exception 'INVALID_PAYMENT_EVENT_AGGREGATE_TYPE'
      using errcode = '22023';
  end if;

  insert into public.payment_events (
    event_type,
    aggregate_type,
    aggregate_id,
    service_id,
    payload
  )
  values (
    p_event_type,
    p_aggregate_type,
    p_aggregate_id,
    p_service_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

-- payment_claim_charge_batch: emit ChargeAttemptStarted per claimed row.
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

-- payment_begin_manual_attempt: emit ManualPaymentInitiated.
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

-- payment_persist_client_card_token: emit CardTokenized; bind netcred_company_id.
drop function if exists public.payment_persist_client_card_token(
  uuid, text, text, text, text, smallint, smallint, text, jsonb, public.payment_gateway_slug
);

create or replace function public.payment_persist_client_card_token(
  p_client_id uuid,
  p_gateway_payment_profile_id text,
  p_card_number_masked text,
  p_card_brand text,
  p_gateway_card_token text,
  p_expiry_month smallint,
  p_expiry_year smallint,
  p_cardholder_name text,
  p_billing_address jsonb,
  p_netcred_company_id text,
  p_gateway_slug public.payment_gateway_slug default 'netcred'::public.payment_gateway_slug
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_id uuid;
  v_max_active int;
  v_active_count int;
  v_existing_id uuid;
  v_existing_state public.payment_client_card_token_state;
  v_profile_id text := trim(p_gateway_payment_profile_id);
  v_company_id text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_persist_client_card_token'
      using errcode = '42501';
  end if;

  if p_client_id is null then
    raise exception 'p_client_id is required'
      using errcode = '22023';
  end if;

  if p_gateway_payment_profile_id is null or trim(p_gateway_payment_profile_id) = '' then
    raise exception 'p_gateway_payment_profile_id is required'
      using errcode = '22023';
  end if;

  if p_netcred_company_id is null or trim(p_netcred_company_id) = '' then
    raise exception 'p_netcred_company_id is required'
      using errcode = '22023';
  end if;

  v_company_id := trim(p_netcred_company_id);

  if p_card_brand is null or trim(p_card_brand) = '' then
    raise exception 'p_card_brand is required'
      using errcode = '22023';
  end if;

  if p_gateway_card_token is null or trim(p_gateway_card_token) = '' then
    raise exception 'p_gateway_card_token is required'
      using errcode = '22023';
  end if;

  if p_billing_address is null or jsonb_typeof(p_billing_address) <> 'object' then
    raise exception 'p_billing_address must be a JSON object'
      using errcode = '22023';
  end if;

  if public.payment_client_card_token_is_expired(p_expiry_month, p_expiry_year) then
    raise exception 'CLIENT_CARD_TOKEN_EXPIRED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'CLIENT_CARD_TOKEN_EXPIRED')::text;
  end if;

  -- ACTIVE token cap (CHK-042f): allow in-place refresh of an already-ACTIVE profile.
  v_max_active := public.platform_constant_int('max_active_client_card_tokens', 8);

  select cct.id, cct.state
  into v_existing_id, v_existing_state
  from public.client_card_tokens cct
  where cct.client_id = p_client_id
    and cct.gateway_payment_profile_id = v_profile_id;

  if v_existing_id is null
    or v_existing_state is distinct from 'ACTIVE'::public.payment_client_card_token_state
  then
    select count(*)::int
    into v_active_count
    from public.client_card_tokens cct
    where cct.client_id = p_client_id
      and cct.state = 'ACTIVE'::public.payment_client_card_token_state;

    if coalesce(v_active_count, 0) >= v_max_active then
      raise exception 'MAX_ACTIVE_CARD_TOKENS'
        using
          errcode = 'P0001',
          detail = jsonb_build_object(
            'code', 'MAX_ACTIVE_CARD_TOKENS',
            'max_active', v_max_active
          )::text;
    end if;
  end if;

  insert into public.client_card_tokens (
    client_id,
    gateway_slug,
    gateway_payment_profile_id,
    netcred_company_id,
    card_number_masked,
    card_brand,
    gateway_card_token,
    expiry_month,
    expiry_year,
    cardholder_name,
    billing_address,
    state
  )
  values (
    p_client_id,
    p_gateway_slug,
    v_profile_id,
    v_company_id,
    coalesce(p_card_number_masked, ''),
    upper(trim(p_card_brand)),
    trim(p_gateway_card_token),
    p_expiry_month,
    p_expiry_year,
    trim(p_cardholder_name),
    p_billing_address,
    'ACTIVE'::public.payment_client_card_token_state
  )
  on conflict on constraint client_card_tokens_client_profile_unique
  do update set
    netcred_company_id = excluded.netcred_company_id,
    card_number_masked = excluded.card_number_masked,
    card_brand = excluded.card_brand,
    gateway_card_token = excluded.gateway_card_token,
    expiry_month = excluded.expiry_month,
    expiry_year = excluded.expiry_year,
    cardholder_name = excluded.cardholder_name,
    billing_address = excluded.billing_address,
    state = 'ACTIVE'::public.payment_client_card_token_state,
    updated_at = now()
  returning id into v_token_id;

  perform public.payment_write_audit(
    p_event_type := 'CARD_TOKEN_PERSISTED',
    p_entity_type := 'client_card_token',
    p_entity_id := v_token_id,
    p_to_state := 'ACTIVE',
    p_actor := 'system',
    p_metadata := jsonb_build_object(
      'client_id', p_client_id,
      'card_brand', upper(trim(p_card_brand)),
      'gateway_payment_profile_id', v_profile_id
    )
  );

  perform public.payment_write_event(
    p_event_type := 'CardTokenized',
    p_aggregate_type := 'client_card_token',
    p_aggregate_id := v_token_id,
    p_service_id := null,
    p_payload := jsonb_build_object(
      'client_id', p_client_id,
      'card_brand', upper(trim(p_card_brand)),
      'gateway_slug', p_gateway_slug
    )
  );

  return jsonb_build_object(
    'client_card_token_id', v_token_id,
    'card_number_masked', coalesce(p_card_number_masked, ''),
    'card_brand', upper(trim(p_card_brand)),
    'state', 'ACTIVE'
  );
end;
$$;

-- payment_ingest_webhook_event: emit WebhookReceived on first validated ingest (not dedup/unsigned).
drop function if exists public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb
);

create or replace function public.payment_ingest_webhook_event(
  p_gateway_slug public.payment_gateway_slug,
  p_event_type text,
  p_gateway_event_id text,
  p_raw_payload jsonb,
  p_raw_headers jsonb,
  p_signature_validated boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type text;
  v_gateway_event_id text;
  v_event_id uuid;
  v_state public.payment_webhook_event_state;
  v_is_duplicate boolean;
  v_sanitized_headers jsonb;
  v_service_id uuid;
  v_signature_validated boolean := coalesce(p_signature_validated, false);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_ingest_webhook_event'
      using errcode = '42501';
  end if;

  if p_event_type is null or btrim(p_event_type) = '' then
    raise exception 'p_event_type is required'
      using errcode = '22023';
  end if;

  if p_gateway_event_id is null or btrim(p_gateway_event_id) = '' then
    raise exception 'p_gateway_event_id is required'
      using errcode = '22023';
  end if;

  if p_raw_payload is null or jsonb_typeof(p_raw_payload) <> 'object' then
    raise exception 'p_raw_payload must be a JSON object'
      using errcode = '22023';
  end if;

  if p_raw_headers is null or jsonb_typeof(p_raw_headers) <> 'object' then
    raise exception 'p_raw_headers must be a JSON object'
      using errcode = '22023';
  end if;

  v_event_type := btrim(p_event_type);
  v_gateway_event_id := btrim(p_gateway_event_id);
  v_sanitized_headers := public.payment_sanitize_webhook_headers(p_raw_headers);

  if not v_signature_validated then
    insert into public.payment_webhook_events (
      gateway_slug,
      event_type,
      gateway_event_id,
      raw_payload,
      raw_headers,
      state,
      failure_reason,
      signature_validated
    )
    values (
      p_gateway_slug,
      v_event_type,
      v_gateway_event_id,
      p_raw_payload,
      v_sanitized_headers,
      'DEAD_LETTER'::public.payment_webhook_event_state,
      'INVALID_SIGNATURE',
      false
    )
    returning id, state, is_duplicate
    into v_event_id, v_state, v_is_duplicate;

    return jsonb_build_object(
      'status', 'quarantined',
      'event_id', v_event_id,
      'gateway_slug', p_gateway_slug,
      'event_type', v_event_type,
      'gateway_event_id', v_gateway_event_id,
      'state', v_state,
      'is_duplicate', false,
      'signature_validated', false
    );
  end if;

  insert into public.payment_webhook_events (
    gateway_slug,
    event_type,
    gateway_event_id,
    raw_payload,
    raw_headers,
    state,
    signature_validated
  )
  values (
    p_gateway_slug,
    v_event_type,
    v_gateway_event_id,
    p_raw_payload,
    v_sanitized_headers,
    'RECEIVED'::public.payment_webhook_event_state,
    true
  )
  on conflict (gateway_slug, event_type, gateway_event_id) where (signature_validated) do update
  set
    is_duplicate = true,
    state = case
      when payment_webhook_events.state in (
        'PROCESSED'::public.payment_webhook_event_state,
        'DEAD_LETTER'::public.payment_webhook_event_state
      ) then payment_webhook_events.state
      else 'DUPLICATE'::public.payment_webhook_event_state
    end,
    updated_at = now()
  returning id, state, is_duplicate
  into v_event_id, v_state, v_is_duplicate;

  if v_is_duplicate then
    return jsonb_build_object(
      'status', 'duplicate',
      'event_id', v_event_id,
      'gateway_slug', p_gateway_slug,
      'event_type', v_event_type,
      'gateway_event_id', v_gateway_event_id,
      'state', v_state,
      'is_duplicate', true,
      'signature_validated', true
    );
  end if;

  select ps.contracted_service_id
  into v_service_id
  from public.payment_schedules ps
  where ps.contracted_service_id =
    nullif(btrim(p_raw_payload #>> '{data,transactionUpdate,referenceCode}'), '')::uuid
  limit 1;

  perform public.payment_write_event(
    p_event_type := 'WebhookReceived',
    p_aggregate_type := 'payment_webhook_event',
    p_aggregate_id := v_event_id,
    p_service_id := v_service_id,
    p_payload := jsonb_build_object(
      'gateway_slug', p_gateway_slug,
      'gateway_event_id', v_gateway_event_id,
      'webhook_event_type', v_event_type,
      'state', v_state,
      'signature_validated', true
    )
  );

  return jsonb_build_object(
    'status', 'inserted',
    'event_id', v_event_id,
    'gateway_slug', p_gateway_slug,
    'event_type', v_event_type,
    'gateway_event_id', v_gateway_event_id,
    'state', v_state,
    'is_duplicate', false,
    'signature_validated', true
  );
end;
$$;

comment on function public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb, boolean
) is
  'Persists NetCred webhooks: validated→RECEIVED + WebhookReceived; unsigned→DEAD_LETTER quarantine (service_role only).';

revoke all on function public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb, boolean
) from public;
revoke all on function public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb, boolean
) from anon;
revoke all on function public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb, boolean
) from authenticated;

grant execute on function public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb, boolean
) to service_role;
