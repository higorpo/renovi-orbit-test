-- pgTAP: payment EF hardening — sandbox token, rate limit, lease revert, reconciliation, tokenize guard.

begin;

select plan(14);

create or replace function pg_temp.payment_set_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
end;
$$;

create or replace function pg_temp.payment_reset_auth()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', gen_random_uuid()::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

-- is_sandbox column
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_gateway_tokens'
      and column_name = 'is_sandbox'
      and is_nullable = 'NO'
      and column_default = 'false'
  ),
  'payment_gateway_tokens.is_sandbox exists with not null default false'
);

-- acquire_or_refresh_netcred_token returns is_sandbox on refresh
select pg_temp.payment_set_service_role();

select is(
  (
    public.acquire_or_refresh_netcred_token(
      'pgtap-sandbox-token',
      now() + interval '1 day',
      true
    )->>'is_sandbox'
  )::boolean,
  true,
  'acquire_or_refresh_netcred_token refreshed payload includes is_sandbox=true'
);

select is(
  (
    public.acquire_or_refresh_netcred_token()->>'is_sandbox'
  )::boolean,
  true,
  'acquire_or_refresh_netcred_token cached payload includes is_sandbox'
);

-- payment_increment_reconciliation_failure
select pg_temp.payment_reset_auth();

select throws_ok(
  $$ select public.payment_increment_reconciliation_failure(gen_random_uuid()) $$,
  '42501',
  'service_role required for payment_increment_reconciliation_failure',
  'payment_increment_reconciliation_failure rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_increment_reconciliation_failure(gen_random_uuid()) $$,
  'P0002',
  'SCHEDULE_NOT_FOUND',
  'payment_increment_reconciliation_failure rejects missing schedule'
);

-- payment_validate_tokenize_checkout_access
select pg_temp.payment_reset_auth();

select throws_ok(
  $$ select public.payment_validate_tokenize_checkout_access(
    gen_random_uuid(),
    gen_random_uuid()
  ) $$,
  '42501',
  'service_role required for payment_validate_tokenize_checkout_access',
  'payment_validate_tokenize_checkout_access rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_validate_tokenize_checkout_access(
    gen_random_uuid(),
    gen_random_uuid()
  ) $$,
  '42501',
  'FORBIDDEN',
  'payment_validate_tokenize_checkout_access rejects unknown proposal/client pair'
);

-- payment_begin_manual_attempt rate limit
select pg_temp.payment_reset_auth();

select throws_ok(
  $$ select public.payment_begin_manual_attempt(
    gen_random_uuid(),
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
    'clearsale-session'
  ) $$,
  '42501',
  'service_role required for payment_begin_manual_attempt',
  'payment_begin_manual_attempt rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

do $$
declare
  v_client_id uuid := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;
  v_i int;
begin
  for v_i in 1..10 loop
    perform public.platform_check_rate_limit(
      format('manual_charge:%s', v_client_id),
      10
    );
  end loop;
end;
$$;

select throws_ok(
  $$ select public.payment_begin_manual_attempt(
    gen_random_uuid(),
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
    'clearsale-session'
  ) $$,
  'P0001',
  'RATE_LIMIT_EXCEEDED',
  'payment_begin_manual_attempt enforces manual_charge rate limit at 10 per minute'
);

-- payment_enqueue_notifications CHARGE_IN_ANALYSIS support
select pg_temp.payment_reset_auth();

select throws_ok(
  $$ select public.payment_enqueue_notifications(
    gen_random_uuid(),
    'CHARGE_IN_ANALYSIS'
  ) $$,
  '42501',
  'service_role required for payment_enqueue_notifications',
  'payment_enqueue_notifications rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_enqueue_notifications(
    gen_random_uuid(),
    'CHARGE_IN_ANALYSIS'
  ) $$,
  'P0002',
  'SCHEDULE_NOT_FOUND',
  'CHARGE_IN_ANALYSIS is accepted before schedule lookup failure'
);

select pg_temp.payment_reset_auth();

select throws_ok(
  $$ select public.payment_enqueue_notifications(
    gen_random_uuid(),
    'NOT_A_REAL_EVENT'
  ) $$,
  '42501',
  'service_role required for payment_enqueue_notifications',
  'payment_enqueue_notifications rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

do $seed$
declare
  v_service_id uuid := gen_random_uuid();
  v_schedule_id uuid := gen_random_uuid();
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_pricing record;
  v_slot jsonb;
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select
    v_service_request_id, sr.client_id, sr.service_id, sr.address_id,
    format('enqueue unsupported pgTAP %s', v_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform set_config('request.jwt.claim.sub', '5d09e025-20a2-4842-aeef-324d42a431e1'::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'role', 'authenticated',
      'sub', '5d09e025-20a2-4842-aeef-324d42a431e1'::text
    )::text,
    true
  );

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid, v_service_request_id,
    v_pricing.original_amount, 'enqueue unsupported pgTAP proposal', 2, 'hours',
    jsonb_build_array(v_slot), '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount,
    v_pricing.final_amount, v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_shift,
    agreed_slot, status
  )
  values (
    v_service_id,
    v_service_request_id,
    v_proposal_id,
    v_client_id,
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'hours', 2, current_date, 'morning',
    v_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    id,
    contracted_service_id,
    client_id,
    provider_id,
    gateway_slug,
    installment_number,
    base_amount,
    commission_rate_pct,
    provider_payout,
    charge_scheduled_at,
    state,
    idempotency_key
  )
  values (
    v_schedule_id,
    v_service_id,
    v_client_id,
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'netcred',
    1,
    100.00,
    10.00,
    90.00,
    now() + interval '24 hours',
    'SCHEDULED'::public.payment_schedule_state,
    v_service_id::text
  );

  perform set_config('payment_ef.unsupported_schedule_id', v_schedule_id::text, true);
  perform pg_temp.payment_set_service_role();
end;
$seed$;

select throws_ok(
  format(
    $$ select public.payment_enqueue_notifications(%L::uuid, 'NOT_A_REAL_EVENT') $$,
    current_setting('payment_ef.unsupported_schedule_id')
  ),
  '22023',
  'UNSUPPORTED_NOTIFICATION_EVENT',
  'payment_enqueue_notifications still rejects unsupported events'
);

-- SECURITY DEFINER on new RPCs
select ok(
  (
    select bool_and(p.prosecdef)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'payment_increment_reconciliation_failure',
        'payment_validate_tokenize_checkout_access'
      )
  ),
  'new payment hardening RPCs are SECURITY DEFINER'
);

select finish();

rollback;
