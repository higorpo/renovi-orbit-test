-- pgTAP: payment Task 115 — RLS deny-all matrix for nine payment-domain tables.
-- Runtime cross-access: anon blocked; service_role-only tables; participant scoping; no client writes.

begin;

create or replace function pg_temp.rls_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

create or replace function pg_temp.rls_set_anon()
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
    true
  );
end;
$$;

create or replace function pg_temp.rls_seed_user(
  p_user_id uuid,
  p_role text default 'client',
  p_name text default 'RLS test user'
)
returns void
language plpgsql
as $$
declare
  v_meta_role text := case when p_role = 'admin' then 'client' else p_role end;
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_user_id::text || '@rls-test.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', p_name, 'role', v_meta_role)::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_user_id,
    json_build_object(
      'sub',
      p_user_id::text,
      'email',
      p_user_id::text || '@rls-test.local'
    )::jsonb,
    'email',
    p_user_id::text,
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do nothing;
end;
$$;

select plan(33);

select set_config('payment.rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('payment.rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('payment.rls.stranger_id', 'b2222222-2222-4222-8222-222222222222', true);

select pg_temp.rls_seed_user(
  current_setting('payment.rls.stranger_id')::uuid,
  'client',
  'Payment RLS stranger'
);

create or replace function pg_temp.payment_rls_seed_matrix()
returns void
language plpgsql
as $$
declare
  v_client_id uuid := current_setting('payment.rls.client_id')::uuid;
  v_provider_id uuid := current_setting('payment.rls.provider_id')::uuid;
  v_stranger_id uuid := current_setting('payment.rls.stranger_id')::uuid;
  v_service_id uuid := 'c1150000-0000-4000-8000-000000000001'::uuid;
  v_schedule_id uuid;
  v_client_card_id uuid := 'c1150000-0000-4000-8000-000000000011'::uuid;
  v_stranger_card_id uuid := 'c1150000-0000-4000-8000-000000000012'::uuid;
  v_pga_id uuid := 'c1150000-0000-4000-8000-000000000021'::uuid;
  v_webhook_event_id uuid := 'c1150000-0000-4000-8000-000000000031'::uuid;
  v_proposal record;
  v_slot jsonb;
begin
  select p.*
  into v_proposal
  from public.provider_proposals p
  where p.provider_id = v_provider_id
  limit 1;

  v_slot := coalesce(
    v_proposal.proposal_suggested_slots->0,
    jsonb_build_object('start_date', current_date::text, 'end_date', current_date::text, 'shift', 'morning')
  );

  insert into public.contracted_services (
    id,
    service_request_id,
    accepted_proposal_id,
    client_id,
    provider_id,
    duration_unit,
    duration_value,
    scheduled_start_date,
    scheduled_shift,
    agreed_slot,
    status
  )
  values (
    v_service_id,
    v_proposal.service_request_id,
    v_proposal.id,
    v_client_id,
    v_provider_id,
    'hours',
    2,
    current_date + 3,
    'morning',
    v_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  )
  on conflict (id) do nothing;

  insert into public.client_card_tokens (
    id,
    client_id,
    gateway_payment_profile_id,
    card_number_masked,
    card_brand,
    gateway_card_token,
    expiry_month,
    expiry_year,
    cardholder_name,
    billing_address
  )
  values
    (
      v_client_card_id,
      v_client_id,
      'matrix-client-profile',
      '411111******1111',
      'VISA',
      'opaque-client-token',
      12,
      2030,
      'Client Matrix',
      '{"street":"Rua A","number":"1","district":"Centro","city":"SP","state":"SP","zipCode":"01000000"}'::jsonb
    ),
    (
      v_stranger_card_id,
      v_stranger_id,
      'matrix-stranger-profile',
      '555555******4444',
      'MASTERCARD',
      'opaque-stranger-token',
      6,
      2031,
      'Stranger Matrix',
      '{"street":"Rua B","number":"2","district":"Centro","city":"SP","state":"SP","zipCode":"02000000"}'::jsonb
    )
  on conflict (id) do nothing;

  insert into public.provider_gateway_accounts (
    id,
    provider_id,
    document,
    onboarding_status
  )
  values (
    v_pga_id,
    v_provider_id,
    '12345678901',
    'ACTIVE'::public.payment_provider_onboarding_status
  )
  on conflict (provider_id, gateway_slug) do update
    set document = excluded.document;

  insert into public.payment_schedules (
    contracted_service_id,
    client_id,
    provider_id,
    client_card_token_id,
    installment_number,
    base_amount,
    commission_rate_pct,
    provider_payout,
    charge_scheduled_at,
    state,
    idempotency_key
  )
  values (
    v_service_id,
    v_client_id,
    v_provider_id,
    v_client_card_id,
    1,
    100.00,
    10.00,
    90.00,
    now() + interval '2 days',
    'SCHEDULED'::public.payment_schedule_state,
    v_service_id::text
  )
  on conflict (contracted_service_id) do nothing
  returning id into v_schedule_id;

  if v_schedule_id is null then
    select ps.id
    into v_schedule_id
    from public.payment_schedules ps
    where ps.contracted_service_id = v_service_id;
  end if;

  insert into public.payment_gateway_tokens (
    gateway_slug,
    token,
    expires_at
  )
  values (
    'netcred',
    'matrix-jwt-token',
    now() + interval '1 hour'
  )
  on conflict (gateway_slug) do update
    set token = excluded.token,
        expires_at = excluded.expires_at;

  insert into public.payment_attempts (
    schedule_id,
    attempt_number,
    initiator,
    outcome
  )
  values (
    v_schedule_id,
    1,
    'cron'::public.payment_attempt_initiator,
    'ERROR'::public.payment_attempt_outcome
  )
  on conflict (schedule_id, attempt_number, initiator) do nothing;

  insert into public.payment_webhook_events (
    id,
    gateway_slug,
    event_type,
    gateway_event_id,
    raw_payload,
    raw_headers
  )
  values (
    v_webhook_event_id,
    'netcred',
    'CHARGE_PAID',
    'matrix-webhook-event-1',
    '{"referenceCode":"matrix"}'::jsonb,
    '{"x-test":"1"}'::jsonb
  )
  on conflict (gateway_slug, event_type, gateway_event_id) do nothing;

  insert into public.payment_webhook_processing_queue (
    webhook_event_id,
    event_type
  )
  values (
    v_webhook_event_id,
    'CHARGE_PAID'
  )
  on conflict (webhook_event_id) do nothing;

  perform public.payment_write_audit(
    p_event_type := 'RLS_MATRIX_FIXTURE',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule_id,
    p_service_id := v_service_id,
    p_schedule_id := v_schedule_id,
    p_actor := 'system'::public.payment_audit_actor
  );

  perform public.payment_write_event(
    p_event_type := 'RlsMatrixFixture',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule_id,
    p_service_id := v_service_id,
    p_payload := '{"fixture": true}'::jsonb
  );

  perform set_config('payment.rls.schedule_id', v_schedule_id::text, true);
  perform set_config('payment.rls.client_card_id', v_client_card_id::text, true);
  perform set_config('payment.rls.stranger_card_id', v_stranger_card_id::text, true);
end;
$$;

select pg_temp.payment_rls_seed_matrix();

select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'payment_gateway_tokens',
        'client_card_tokens',
        'provider_gateway_accounts',
        'payment_schedules',
        'payment_attempts',
        'payment_webhook_events',
        'payment_webhook_processing_queue',
        'payment_audit_log',
        'payment_events'
      )
  ),
  'all nine payment-domain tables have RLS enabled'
);

select pg_temp.rls_set_anon();

select throws_ok($$ select count(*) from public.payment_gateway_tokens $$, '42501', null, 'anon cannot read payment_gateway_tokens');
select throws_ok($$ select count(*) from public.client_card_tokens $$, '42501', null, 'anon cannot read client_card_tokens');
select throws_ok($$ select count(*) from public.provider_gateway_accounts $$, '42501', null, 'anon cannot read provider_gateway_accounts');
select throws_ok($$ select count(*) from public.payment_schedules $$, '42501', null, 'anon cannot read payment_schedules');
select throws_ok($$ select count(*) from public.payment_attempts $$, '42501', null, 'anon cannot read payment_attempts');
select throws_ok($$ select count(*) from public.payment_webhook_events $$, '42501', null, 'anon cannot read payment_webhook_events');
select throws_ok($$ select count(*) from public.payment_webhook_processing_queue $$, '42501', null, 'anon cannot read payment_webhook_processing_queue');
select throws_ok($$ select count(*) from public.payment_audit_log $$, '42501', null, 'anon cannot read payment_audit_log');
select throws_ok($$ select count(*) from public.payment_events $$, '42501', null, 'anon cannot read payment_events');

select pg_temp.rls_set_auth(current_setting('payment.rls.client_id')::uuid);

select throws_ok($$ select count(*) from public.payment_gateway_tokens $$, '42501', null, 'client cannot read payment_gateway_tokens');
select throws_ok($$ select count(*) from public.payment_attempts $$, '42501', null, 'client cannot read payment_attempts');
select throws_ok($$ select count(*) from public.payment_webhook_events $$, '42501', null, 'client cannot read payment_webhook_events');
select throws_ok($$ select count(*) from public.payment_webhook_processing_queue $$, '42501', null, 'client cannot read payment_webhook_processing_queue');

select is(
  (select count(*)::int from public.payment_audit_log),
  0,
  'client cannot read payment_audit_log rows (admin-only RLS)'
);

select is(
  (select count(*)::int from public.payment_events),
  0,
  'client cannot read payment_events rows (admin-only RLS)'
);

select is(
  (
    select count(*)::int
    from public.client_card_tokens
    where id = current_setting('payment.rls.client_card_id')::uuid
  ),
  1,
  'client can read own card token'
);

select is(
  (
    select count(*)::int
    from public.client_card_tokens
    where id = current_setting('payment.rls.stranger_card_id')::uuid
  ),
  0,
  'client cannot read another client card token'
);

select is(
  (
    select count(*)::int
    from public.provider_gateway_accounts
    where provider_id = current_setting('payment.rls.provider_id')::uuid
  ),
  0,
  'client cannot read provider gateway account'
);

select is(
  (
    select count(*)::int
    from public.payment_schedules
    where id = current_setting('payment.rls.schedule_id')::uuid
  ),
  1,
  'client participant can read own payment schedule'
);

select pg_temp.rls_set_auth(current_setting('payment.rls.provider_id')::uuid);

select is(
  (
    select count(*)::int
    from public.provider_gateway_accounts
    where provider_id = current_setting('payment.rls.provider_id')::uuid
  ),
  1,
  'provider can read own gateway account'
);

select is(
  (
    select count(*)::int
    from public.client_card_tokens
    where client_id = current_setting('payment.rls.client_id')::uuid
  ),
  0,
  'provider cannot read client card tokens'
);

select is(
  (
    select count(*)::int
    from public.payment_schedules
    where id = current_setting('payment.rls.schedule_id')::uuid
  ),
  1,
  'provider participant can read shared payment schedule'
);

select pg_temp.rls_set_auth(current_setting('payment.rls.stranger_id')::uuid);

select is(
  (
    select count(*)::int
    from public.payment_schedules
    where id = current_setting('payment.rls.schedule_id')::uuid
  ),
  0,
  'unrelated authenticated user cannot read participant payment schedule'
);

select throws_ok(
  $$ insert into public.payment_schedules (
       contracted_service_id, client_id, provider_id, installment_number,
       base_amount, commission_rate_pct, provider_payout, charge_scheduled_at, idempotency_key
     ) values (
       gen_random_uuid(), current_setting('payment.rls.client_id')::uuid,
       current_setting('payment.rls.provider_id')::uuid, 1,
       100, 10, 90, now(), gen_random_uuid()::text
     ) $$,
  '42501',
  null,
  'authenticated cannot insert payment_schedules directly'
);

select throws_ok(
  $$ insert into public.client_card_tokens (
       client_id, gateway_payment_profile_id, card_number_masked, card_brand,
       gateway_card_token, expiry_month, expiry_year, cardholder_name, billing_address
     ) values (
       current_setting('payment.rls.client_id')::uuid, 'blocked-profile', '0000', 'VISA',
       'blocked', 1, 2030, 'Blocked', '{}'::jsonb
     ) $$,
  '42501',
  null,
  'authenticated cannot insert client_card_tokens directly'
);

select throws_ok(
  $$ insert into public.provider_gateway_accounts (provider_id, document)
     values (current_setting('payment.rls.provider_id')::uuid, '00000000000') $$,
  '42501',
  null,
  'authenticated cannot insert provider_gateway_accounts directly'
);

select throws_ok(
  $$ insert into public.payment_gateway_tokens (gateway_slug, token, expires_at)
     values ('netcred', 'blocked', now() + interval '1 hour') $$,
  '42501',
  null,
  'authenticated cannot insert payment_gateway_tokens'
);

select throws_ok(
  $$ insert into public.payment_attempts (schedule_id, attempt_number, initiator)
     values (current_setting('payment.rls.schedule_id')::uuid, 99, 'cron') $$,
  '42501',
  null,
  'authenticated cannot insert payment_attempts'
);

select throws_ok(
  $$ insert into public.payment_webhook_events (
       gateway_slug, event_type, gateway_event_id, raw_payload, raw_headers
     ) values ('netcred', 'TEST', 'blocked', '{}'::jsonb, '{}'::jsonb) $$,
  '42501',
  null,
  'authenticated cannot insert payment_webhook_events'
);

select throws_ok(
  $$ insert into public.payment_webhook_processing_queue (webhook_event_id, event_type)
     values (gen_random_uuid(), 'TEST') $$,
  '42501',
  null,
  'authenticated cannot insert payment_webhook_processing_queue'
);

select throws_ok(
  $$ insert into public.payment_audit_log (event_type, entity_type, entity_id, actor)
     values ('BLOCKED', 'payment_schedule', gen_random_uuid(), 'system') $$,
  '42501',
  null,
  'authenticated cannot insert payment_audit_log'
);

select throws_ok(
  $$ insert into public.payment_events (event_type, aggregate_type, aggregate_id)
     values ('Blocked', 'payment_schedule', gen_random_uuid()) $$,
  '42501',
  null,
  'authenticated cannot insert payment_events'
);

select finish();
rollback;
