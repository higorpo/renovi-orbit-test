-- Payment EF hardening: sandbox token cache, rate limits, dry-run lease revert,
-- reconciliation failure RPC, tokenize access guard, claim batch enrichment, CHARGE_IN_ANALYSIS notify.

-- 1. payment_gateway_tokens.is_sandbox
alter table public.payment_gateway_tokens
  add column if not exists is_sandbox boolean not null default false;

comment on column public.payment_gateway_tokens.is_sandbox is
  'True when the cached JWT was issued for a NetCred sandbox account.';

-- 2. acquire_or_refresh_netcred_token — p_is_sandbox on upsert; return is_sandbox in cached/refreshed JSON
drop function if exists public.acquire_or_refresh_netcred_token(text, timestamptz);

create or replace function public.acquire_or_refresh_netcred_token(
  p_new_token text default null,
  p_expires_at timestamptz default null,
  p_is_sandbox boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.payment_gateway_tokens%rowtype;
  v_refresh_threshold interval := interval '60 minutes';
  v_lock_key bigint := 880001;
  v_wait_attempt int;
begin
  perform set_config('lock_timeout', '500ms', true);

  if p_new_token is not null then
    insert into public.payment_gateway_tokens (
      gateway_slug,
      token,
      expires_at,
      refreshed_at,
      is_sandbox
    )
    values (
      'netcred',
      p_new_token,
      coalesce(p_expires_at, now() + interval '24 hours'),
      now(),
      coalesce(p_is_sandbox, false)
    )
    on conflict (gateway_slug) do update
    set
      token = excluded.token,
      expires_at = excluded.expires_at,
      refreshed_at = now(),
      updated_at = now(),
      is_sandbox = case
        when p_is_sandbox is not null then p_is_sandbox
        else payment_gateway_tokens.is_sandbox
      end
    returning * into v_row;

    perform pg_advisory_unlock(v_lock_key);

    return jsonb_build_object(
      'status', 'refreshed',
      'token', v_row.token,
      'expires_at', v_row.expires_at,
      'is_sandbox', v_row.is_sandbox
    );
  end if;

  select *
  into v_row
  from public.payment_gateway_tokens pgt
  where pgt.gateway_slug = 'netcred'
  for update;

  if found and v_row.expires_at > now() + v_refresh_threshold then
    return jsonb_build_object(
      'status', 'cached',
      'token', v_row.token,
      'expires_at', v_row.expires_at,
      'is_sandbox', v_row.is_sandbox
    );
  end if;

  if not pg_try_advisory_lock(v_lock_key) then
    for v_wait_attempt in 1..30 loop
      select *
      into v_row
      from public.payment_gateway_tokens pgt
      where pgt.gateway_slug = 'netcred';

      if found and v_row.expires_at > now() + v_refresh_threshold then
        return jsonb_build_object(
          'status', 'cached',
          'token', v_row.token,
          'expires_at', v_row.expires_at,
          'is_sandbox', v_row.is_sandbox
        );
      end if;

      perform pg_sleep(0.2);
    end loop;

    raise exception 'NETCRED_TOKEN_REFRESH_WAIT_TIMEOUT'
      using errcode = 'P0001';
  end if;

  select *
  into v_row
  from public.payment_gateway_tokens pgt
  where pgt.gateway_slug = 'netcred'
  for update;

  if found and v_row.expires_at > now() + v_refresh_threshold then
    perform pg_advisory_unlock(v_lock_key);
    return jsonb_build_object(
      'status', 'cached',
      'token', v_row.token,
      'expires_at', v_row.expires_at,
      'is_sandbox', v_row.is_sandbox
    );
  end if;

  return jsonb_build_object('status', 'needs_refresh');
end;
$$;

comment on function public.acquire_or_refresh_netcred_token(text, timestamptz, boolean) is
  'Lock + read NetCred JWT cache; upsert after EF tokenAuth with optional is_sandbox; advisory lock serializes refresh.';

revoke all on function public.acquire_or_refresh_netcred_token(text, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.acquire_or_refresh_netcred_token(text, timestamptz, boolean)
  to service_role, postgres;

-- 3. payment_begin_manual_attempt — rate limit manual_charge:{client_id} at 10/min
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

comment on function public.payment_begin_manual_attempt(uuid, uuid, text, text, uuid) is
  'Manual charge lease: rate-limited, T-12h gate via payment_service_execution_at, increments manual_attempt_count.';

revoke all on function public.payment_begin_manual_attempt(uuid, uuid, text, text, uuid) from public;
revoke all on function public.payment_begin_manual_attempt(uuid, uuid, text, text, uuid) from anon;
revoke all on function public.payment_begin_manual_attempt(uuid, uuid, text, text, uuid) from authenticated;

grant execute on function public.payment_begin_manual_attempt(uuid, uuid, text, text, uuid) to service_role;

-- 4. payment_revert_dry_run_lease — revert PROCESSING -> SCHEDULED after charge cron dry run
create or replace function public.payment_revert_dry_run_lease(
  p_schedule_id uuid,
  p_attempt_count int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_revert_dry_run_lease'
      using errcode = '42501';
  end if;

  update public.payment_schedules ps
  set
    state = 'SCHEDULED',
    locked_until = null,
    automatic_attempt_count = greatest(0, p_attempt_count - 1),
    updated_at = now()
  where ps.id = p_schedule_id
    and ps.state = 'PROCESSING'::public.payment_schedule_state;
end;
$$;

comment on function public.payment_revert_dry_run_lease(uuid, int) is
  'Reverts charge cron dry-run lease: PROCESSING -> SCHEDULED and decrements automatic_attempt_count.';

revoke all on function public.payment_revert_dry_run_lease(uuid, int) from public;
revoke all on function public.payment_revert_dry_run_lease(uuid, int) from anon;
revoke all on function public.payment_revert_dry_run_lease(uuid, int) from authenticated;

grant execute on function public.payment_revert_dry_run_lease(uuid, int) to service_role;

-- 5. payment_increment_reconciliation_failure — atomic failure counter for reconcile EF
create or replace function public.payment_increment_reconciliation_failure(
  p_schedule_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_increment_reconciliation_failure'
      using errcode = '42501';
  end if;

  update public.payment_schedules ps
  set
    reconciliation_failure_count = ps.reconciliation_failure_count + 1,
    locked_until = null,
    updated_at = now()
  where ps.id = p_schedule_id
  returning ps.reconciliation_failure_count into v_count;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  return v_count;
end;
$$;

comment on function public.payment_increment_reconciliation_failure(uuid) is
  'Increments reconciliation_failure_count and clears lease; returns new count for reconcile-netcred-payments EF.';

revoke all on function public.payment_increment_reconciliation_failure(uuid) from public;
revoke all on function public.payment_increment_reconciliation_failure(uuid) from anon;
revoke all on function public.payment_increment_reconciliation_failure(uuid) from authenticated;

grant execute on function public.payment_increment_reconciliation_failure(uuid) to service_role;

-- 6. payment_validate_tokenize_checkout_access — proposal ownership guard for tokenize EF
create or replace function public.payment_validate_tokenize_checkout_access(
  p_client_id uuid,
  p_proposal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_validate_tokenize_checkout_access'
      using errcode = '42501';
  end if;

  if p_client_id is null or p_proposal_id is null then
    raise exception 'p_client_id and p_proposal_id are required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.provider_proposals pp
    join public.service_requests sr on sr.id = pp.service_request_id
    where pp.id = p_proposal_id
      and sr.client_id = p_client_id
  ) then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

comment on function public.payment_validate_tokenize_checkout_access(uuid, uuid) is
  'Ensures proposal belongs to client service request before tokenize-payment-card EF persists a card.';

revoke all on function public.payment_validate_tokenize_checkout_access(uuid, uuid) from public;
revoke all on function public.payment_validate_tokenize_checkout_access(uuid, uuid) from anon;
revoke all on function public.payment_validate_tokenize_checkout_access(uuid, uuid) from authenticated;

grant execute on function public.payment_validate_tokenize_checkout_access(uuid, uuid) to service_role;

-- 7. payment_claim_charge_batch — include provider_payout and netcred_company_id in batch JSON
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
      ps.provider_payout,
      ps.automatic_attempt_count,
      ps.max_attempts,
      ps.clearsale_session_id,
      ps.client_ip_address,
      pga.netcred_company_id,
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
      e.provider_payout,
      e.netcred_company_id,
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
  end loop;

  return v_rows;
end;
$$;

comment on function public.payment_claim_charge_batch(int) is
  'Cron dequeue: SKIP LOCKED lease, increment automatic_attempt_count, return charge_amount, provider_payout, netcred_company_id per row.';

revoke all on function public.payment_claim_charge_batch(int) from public;
revoke all on function public.payment_claim_charge_batch(int) from anon;
revoke all on function public.payment_claim_charge_batch(int) from authenticated;

grant execute on function public.payment_claim_charge_batch(int) to service_role;

-- 8. payment_claim_stale_schedules_for_reconciliation — include netcred_company_id
create or replace function public.payment_claim_stale_schedules_for_reconciliation(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_stale_minutes int;
  v_lease_minutes int;
  v_rows jsonb := '[]'::jsonb;
  v_row record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_claim_stale_schedules_for_reconciliation'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('reconciliation_batch_size', 50)
    ),
    1
  );

  v_stale_minutes := public.platform_constant_int('reconciliation_poll_interval_minutes', 30);
  v_lease_minutes := public.platform_constant_int('payment_lease_duration_minutes', 10);

  for v_row in
    with eligible as (
      select
        ps.id,
        pga.netcred_company_id
      from public.payment_schedules ps
      join public.provider_gateway_accounts pga
        on pga.provider_id = ps.provider_id
       and pga.gateway_slug = ps.gateway_slug
      where (
          ps.state in (
            'IN_ANALYSIS'::public.payment_schedule_state,
            'PROCESSING'::public.payment_schedule_state,
            'REFUND_REQUESTED'::public.payment_schedule_state
          )
          or (
            ps.state = 'PAID'::public.payment_schedule_state
            and ps.refund_submit_status = 'SUBMITTED'::public.payment_refund_submit_status
            and ps.refunded_at is null
          )
        )
        and ps.updated_at < now() - make_interval(mins => v_stale_minutes)
        and (ps.locked_until is null or ps.locked_until < now())
      order by ps.updated_at
      limit v_batch_size
      for update of ps skip locked
    ),
    claimed as (
      update public.payment_schedules ps
      set locked_until = now() + make_interval(mins => v_lease_minutes)
      from eligible el
      where ps.id = el.id
      returning
        ps.id,
        ps.contracted_service_id,
        ps.client_id,
        ps.provider_id,
        ps.state,
        ps.installment_number,
        ps.base_amount,
        ps.client_card_token_id,
        ps.gateway_charge_id,
        ps.gateway_transaction_id,
        ps.paid_amount,
        ps.refunded_amount,
        ps.refund_submit_status,
        ps.automatic_attempt_count,
        ps.manual_attempt_count,
        ps.max_attempts,
        ps.reconciliation_failure_count,
        ps.updated_at,
        el.netcred_company_id
    )
    select * from claimed
  loop
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'schedule_id', v_row.id,
      'contracted_service_id', v_row.contracted_service_id,
      'reference_code', v_row.contracted_service_id,
      'client_id', v_row.client_id,
      'provider_id', v_row.provider_id,
      'state', v_row.state,
      'installment_number', v_row.installment_number,
      'base_amount', v_row.base_amount,
      'client_card_token_id', v_row.client_card_token_id,
      'gateway_charge_id', v_row.gateway_charge_id,
      'gateway_transaction_id', v_row.gateway_transaction_id,
      'paid_amount', v_row.paid_amount,
      'refunded_amount', v_row.refunded_amount,
      'refund_submit_status', v_row.refund_submit_status,
      'automatic_attempt_count', v_row.automatic_attempt_count,
      'manual_attempt_count', v_row.manual_attempt_count,
      'max_attempts', v_row.max_attempts,
      'reconciliation_failure_count', v_row.reconciliation_failure_count,
      'updated_at', v_row.updated_at,
      'netcred_company_id', v_row.netcred_company_id
    ));
  end loop;

  return v_rows;
end;
$$;

comment on function public.payment_claim_stale_schedules_for_reconciliation(int) is
  'Claims stale intermediate schedules (incl. PAID+SUBMITTED crash recovery) for reconcile-netcred-payments EF; includes netcred_company_id (service_role only).';

revoke all on function public.payment_claim_stale_schedules_for_reconciliation(int) from public;
revoke all on function public.payment_claim_stale_schedules_for_reconciliation(int) from anon;
revoke all on function public.payment_claim_stale_schedules_for_reconciliation(int) from authenticated;

grant execute on function public.payment_claim_stale_schedules_for_reconciliation(int) to service_role;

-- 9. payment_enqueue_notifications — CHARGE_IN_ANALYSIS (client push only)
create or replace function public.payment_enqueue_notifications(
  p_schedule_id uuid,
  p_notification_event text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_event text;
  v_dispatches jsonb := '[]'::jsonb;
  v_result jsonb;
  v_variables jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_enqueue_notifications'
      using errcode = '42501';
  end if;

  if p_schedule_id is null or p_notification_event is null or trim(p_notification_event) = '' then
    raise exception 'p_schedule_id and p_notification_event are required'
      using errcode = '22023';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  v_event := upper(trim(p_notification_event));

  if v_event not in (
    'CHARGE_SUCCEEDED',
    'CHARGE_FAILED',
    'CHARGE_FAILED_PERMANENT',
    'CHARGE_IN_ANALYSIS',
    'UPCOMING_CHARGE',
    'SERVICE_AUTO_CANCELLED'
  ) then
    raise exception 'UNSUPPORTED_NOTIFICATION_EVENT'
      using errcode = '22023';
  end if;

  v_variables := jsonb_build_object(
    'schedule_id', v_schedule.id,
    'contracted_service_id', v_schedule.contracted_service_id,
    'client_id', v_schedule.client_id,
    'provider_id', v_schedule.provider_id,
    'charge_scheduled_at', v_schedule.charge_scheduled_at,
    'paid_amount', v_schedule.paid_amount,
    'state', v_schedule.state
  ) || coalesce(p_metadata, '{}'::jsonb);

  v_result := public.mmd_ingest_event(
    v_event,
    v_schedule.client_id,
    format('payment:%s:%s:client', v_schedule.id, lower(v_event)),
    v_variables,
    jsonb_build_object('source', 'payment_enqueue_notifications', 'recipient', 'client')
  );
  v_dispatches := v_dispatches || jsonb_build_array(v_result);

  if v_event in ('CHARGE_SUCCEEDED', 'CHARGE_FAILED_PERMANENT', 'SERVICE_AUTO_CANCELLED') then
    v_result := public.mmd_ingest_event(
      v_event,
      v_schedule.provider_id,
      format('payment:%s:%s:provider', v_schedule.id, lower(v_event)),
      v_variables,
      jsonb_build_object('source', 'payment_enqueue_notifications', 'recipient', 'provider')
    );
    v_dispatches := v_dispatches || jsonb_build_array(v_result);
  end if;

  return jsonb_build_object(
    'notification_event', v_event,
    'schedule_id', v_schedule.id,
    'dispatches', v_dispatches
  );
end;
$$;

comment on function public.payment_enqueue_notifications(uuid, text, jsonb) is
  'Post-commit MMD enqueue for payment notification matrix; CHARGE_IN_ANALYSIS is client-only push.';

revoke all on function public.payment_enqueue_notifications(uuid, text, jsonb) from public;
revoke all on function public.payment_enqueue_notifications(uuid, text, jsonb) from anon;
revoke all on function public.payment_enqueue_notifications(uuid, text, jsonb) from authenticated;

grant execute on function public.payment_enqueue_notifications(uuid, text, jsonb) to service_role;
