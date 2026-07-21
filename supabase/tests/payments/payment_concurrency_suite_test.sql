-- pgTAP: payment Task 92 — concurrency suite (Req 23.1, 23.4).

begin;

select plan(12);

create or replace function pg_temp.cns_seed_chat(
  p_service_request_id uuid,
  p_client_id uuid,
  p_provider_id uuid,
  p_status public.cns_conversation_status default 'ACTIVE',
  p_last_interaction_at timestamptz default now()
)
returns uuid
language plpgsql
as $$
declare
  v_chat_id uuid;
begin
  insert into public.chats (
    service_request_id,
    client_id,
    provider_id,
    status,
    last_interaction_at
  )
  values (
    p_service_request_id,
    p_client_id,
    p_provider_id,
    p_status,
    p_last_interaction_at
  )
  on conflict (service_request_id, provider_id) do update
    set
      status = excluded.status,
      last_interaction_at = excluded.last_interaction_at,
      updated_at = now()
  returning id into v_chat_id;

  return v_chat_id;
end;
$$;

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

create or replace function pg_temp.payment_set_client_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.payment_claim_batch_once(p_batch_size int default 1)
returns jsonb
language plpgsql
as $$
begin
  drop table if exists _payment_claim_batch_result;
  return public.payment_claim_charge_batch(p_batch_size);
end;
$$;

create or replace function pg_temp.payment_seed_charge_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_schedule_state public.payment_schedule_state default 'SCHEDULED',
  p_charge_at timestamptz default now() - interval '1 minute',
  p_locked_until timestamptz default null,
  p_automatic_attempt_count smallint default 0
)
returns table (
  schedule_id uuid,
  client_id uuid,
  card_token_id uuid
)
language plpgsql
as $$
declare
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_pricing record;
  v_slot jsonb;
  v_card_token_id uuid := gen_random_uuid();
  v_schedule_id uuid := gen_random_uuid();
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
    format('concurrency pgTAP %s', p_contracted_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform set_config('request.jwt.claim.sub', p_provider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_provider_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date + 5, 'YYYY-MM-DD'),
    'end_date', to_char(current_date + 5, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, p_provider_id, v_service_request_id, v_pricing.original_amount,
    'concurrency pgTAP proposal', 1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date,
    scheduled_shift, agreed_slot, status
  )
  values (
    p_contracted_service_id, v_service_request_id, v_proposal_id, v_client_id,
    p_provider_id, 'days', 1, current_date + 5, current_date + 5, 'morning', v_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  insert into public.client_card_tokens (
    id, client_id, gateway_slug, gateway_payment_profile_id, netcred_company_id, card_number_masked,
    card_brand, gateway_card_token, expiry_month, expiry_year, cardholder_name,
    billing_address, state
  )
  values (
    v_card_token_id, v_client_id, 'netcred', format('profile-%s', p_contracted_service_id), '1014',
    '497010XXXXXX0048', 'visa', format('token-%s', p_contracted_service_id), 12, 2030,
    'Concurrency Test', '{}'::jsonb, 'ACTIVE'::public.payment_client_card_token_state
  );

  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    client_card_token_id, installment_number, base_amount, commission_rate_pct,
    provider_payout, charge_scheduled_at, state, idempotency_key,
    locked_until, automatic_attempt_count,
    gateway_reference_code)
  values (
    v_schedule_id, p_contracted_service_id, v_client_id, p_provider_id, 'netcred',
    v_card_token_id, 1, 100.00, 10.00, 90.00, p_charge_at, p_schedule_state,
    p_contracted_service_id::text, p_locked_until, p_automatic_attempt_count,
    p_contracted_service_id);

  schedule_id := v_schedule_id;
  client_id := v_client_id;
  card_token_id := v_card_token_id;
  return next;
end;
$$;

do $seed$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_cs_a uuid := gen_random_uuid();
  v_cs_b uuid := gen_random_uuid();
  v_cs_locked uuid := gen_random_uuid();
  v_fixture record;
begin
  insert into public.provider_gateway_accounts (
    provider_id, gateway_slug, document, onboarding_status, onboarding_activated_at
  )
  values (
    v_provider_id,
    'netcred'::public.payment_gateway_slug,
    '12345678901',
    'ACTIVE'::public.payment_provider_onboarding_status,
    now()
  )
  on conflict (provider_id, gateway_slug) do update
  set onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status;

  select * into v_fixture from pg_temp.payment_seed_charge_fixture(v_cs_a, v_provider_id);
  perform set_config('test.concurrency.schedule_a', v_fixture.schedule_id::text, true);

  select * into v_fixture from pg_temp.payment_seed_charge_fixture(v_cs_b, v_provider_id);
  perform set_config('test.concurrency.schedule_b', v_fixture.schedule_id::text, true);

  select * into v_fixture
  from pg_temp.payment_seed_charge_fixture(
    v_cs_locked,
    v_provider_id,
    'PROCESSING'::public.payment_schedule_state,
    now() - interval '1 minute',
    now() + interval '10 minutes',
    1::smallint
  );
  perform set_config('test.concurrency.schedule_locked', v_fixture.schedule_id::text, true);
end;
$seed$;

select pg_temp.payment_set_service_role();

-- Req 23.1: SKIP LOCKED — batch size 1 claims only one of two eligible schedules.
select is(
  jsonb_array_length(pg_temp.payment_claim_batch_once(1)),
  1,
  'payment_claim_charge_batch(1) claims a single schedule when two are eligible'
);

select is(
  (
    select count(*)::int
    from public.payment_schedules ps
    where ps.id in (
      current_setting('test.concurrency.schedule_a')::uuid,
      current_setting('test.concurrency.schedule_b')::uuid
    )
      and ps.state = 'PROCESSING'::public.payment_schedule_state
  ),
  1,
  'exactly one of two eligible schedules is PROCESSING after first worker claim'
);

select is(
  (
    select count(*)::int
    from public.payment_schedules ps
    where ps.id in (
      current_setting('test.concurrency.schedule_a')::uuid,
      current_setting('test.concurrency.schedule_b')::uuid
    )
      and ps.state = 'SCHEDULED'::public.payment_schedule_state
  ),
  1,
  'second eligible schedule remains SCHEDULED after first worker claim'
);

select is(
  jsonb_array_length(pg_temp.payment_claim_batch_once(1)),
  1,
  'second worker claim acquires the remaining eligible schedule'
);

select is(
  (
    select count(*)::int
    from public.payment_schedules ps
    where ps.id in (
      current_setting('test.concurrency.schedule_a')::uuid,
      current_setting('test.concurrency.schedule_b')::uuid
    )
      and ps.state = 'PROCESSING'::public.payment_schedule_state
  ),
  2,
  'both eligible schedules are PROCESSING after two sequential worker claims'
);

do $seed_eligible$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_cs_eligible uuid := gen_random_uuid();
  v_fixture record;
begin
  select * into v_fixture from pg_temp.payment_seed_charge_fixture(v_cs_eligible, v_provider_id);
  perform set_config('test.concurrency.schedule_eligible', v_fixture.schedule_id::text, true);
end;
$seed_eligible$;

select pg_temp.payment_set_service_role();

select is(
  jsonb_array_length(pg_temp.payment_claim_batch_once(2)),
  1,
  'held PROCESSING lease causes SKIP LOCKED to skip locked row and claim only eligible schedule'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.id = current_setting('test.concurrency.schedule_locked')::uuid
  ),
  'PROCESSING',
  'locked schedule remains PROCESSING when another worker claims a different row'
);

select ok(
  (
    select exists (
      select 1
      from public.payment_schedules ps
      where ps.id in (
        current_setting('test.concurrency.schedule_a')::uuid,
        current_setting('test.concurrency.schedule_b')::uuid
      )
        and ps.state = 'PROCESSING'::public.payment_schedule_state
        and ps.automatic_attempt_count = 1
    )
  ),
  'automatic_attempt_count increments atomically with PROCESSING transition'
);

-- Req 23.4: cron lease blocks concurrent manual payment on the same schedule.
do $seed_manual$
declare
  v_cs_manual uuid := gen_random_uuid();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_fixture record;
begin
  select * into v_fixture
  from pg_temp.payment_seed_charge_fixture(
    v_cs_manual,
    v_provider_id,
    'FAILED'::public.payment_schedule_state
  );

  perform set_config('test.concurrency.schedule_manual', v_fixture.schedule_id::text, true);
  perform set_config('test.concurrency.client_id', v_fixture.client_id::text, true);
end;
$seed_manual$;

select pg_temp.payment_set_service_role();

select is(
  jsonb_array_length(pg_temp.payment_claim_batch_once(1)),
  1,
  'cron claims the FAILED schedule before manual payment race'
);

-- Mint a real ClearSale manual session so begin_manual_attempt reaches schedule-state guard.
do $issue_cs$
declare
  v_client_id uuid := current_setting('test.concurrency.client_id')::uuid;
  v_schedule_id uuid := current_setting('test.concurrency.schedule_manual')::uuid;
  v_session text;
begin
  perform set_config('request.jwt.claim.sub', v_client_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_client_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_session := public.payment_issue_clearsale_session(
    'manual',
    null,
    v_schedule_id
  )->>'session_id';

  perform set_config('test.concurrency.clearsale_session', v_session, true);
end;
$issue_cs$;

select pg_temp.payment_set_service_role();

select throws_ok(
  format(
    $$ select public.payment_begin_manual_attempt(
      %L::uuid,
      %L::uuid,
      %L
    ) $$,
    current_setting('test.concurrency.schedule_manual'),
    current_setting('test.concurrency.client_id'),
    current_setting('test.concurrency.clearsale_session')
  ),
  'P0001',
  'INVALID_SCHEDULE_STATE',
  'manual payment rejected after cron moves schedule to PROCESSING'
);

-- accept_proposal idempotency replay via rpc_idempotency_records.
select lives_ok(
  $sql$
    select public.idempotency_commit(
      'chats.accept_proposal',
      'c3333333-3333-4333-8333-333333333333'::uuid,
      'payment-concurrency-accept-hash',
      200,
      jsonb_build_object(
        'service', jsonb_build_object('id', 'd4444444-4444-4444-8444-444444444444'),
        'proposal', jsonb_build_object('status', 'ACCEPTED')
      )
    );
  $sql$,
  'accept_proposal idempotency cache can be committed'
);

select is(
  public.idempotency_begin(
    'chats.accept_proposal',
    'c3333333-3333-4333-8333-333333333333'::uuid,
    'payment-concurrency-accept-hash'
  )->'response_body'->'service'->>'id',
  'd4444444-4444-4444-8444-444444444444',
  'duplicate accept_proposal idempotency key returns cached contracted service id'
);

select finish();

rollback;
