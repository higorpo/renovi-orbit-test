-- pgTAP: payment Task 97 — failure injection: EF crash after claim → janitor recovery (Req 23.2).

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

create or replace function pg_temp.payment_seed_charge_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_schedule_state public.payment_schedule_state default 'SCHEDULED',
  p_charge_at timestamptz default now() - interval '1 minute',
  p_locked_until timestamptz default null,
  p_automatic_attempt_count smallint default 0,
  p_gateway_charge_id text default null
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
    format('orphan failure injection %s', p_contracted_service_id),
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
    'orphan failure injection proposal', 1, 'days', jsonb_build_array(v_slot),
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
    id, client_id, gateway_slug, gateway_payment_profile_id, card_number_masked,
    card_brand, gateway_card_token, expiry_month, expiry_year, cardholder_name,
    billing_address, state
  )
  values (
    v_card_token_id, v_client_id, 'netcred', format('profile-%s', p_contracted_service_id),
    '497010XXXXXX0048', 'visa', format('token-%s', p_contracted_service_id), 12, 2030,
    'Orphan Failure Injection', '{}'::jsonb, 'ACTIVE'::public.payment_client_card_token_state
  );

  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    client_card_token_id, installment_number, base_amount, commission_rate_pct,
    provider_payout, charge_scheduled_at, state, idempotency_key,
    locked_until, automatic_attempt_count, gateway_charge_id
  )
  values (
    v_schedule_id, p_contracted_service_id, v_client_id, p_provider_id, 'netcred',
    v_card_token_id, 1, 100.00, 10.00, 90.00, p_charge_at, p_schedule_state,
    p_contracted_service_id::text, p_locked_until, p_automatic_attempt_count,
    p_gateway_charge_id
  );

  schedule_id := v_schedule_id;
  client_id := v_client_id;
  card_token_id := v_card_token_id;
  return next;
end;
$$;

create or replace function pg_temp.payment_seed_provider_gateway(p_provider_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.provider_gateway_accounts (
    provider_id, gateway_slug, document, onboarding_status, onboarding_activated_at
  )
  values (
    p_provider_id,
    'netcred'::public.payment_gateway_slug,
    '12345678901',
    'ACTIVE'::public.payment_provider_onboarding_status,
    now()
  )
  on conflict (provider_id, gateway_slug) do update
  set onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status;
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

create or replace function pg_temp.payment_recover_orphans_once()
returns table (
  recovered_count int,
  recovered_to_scheduled int,
  recovered_to_failed int
)
language plpgsql
as $$
begin
  drop table if exists _payment_orphan_recovery_result;
  return query select * from public.payment_recover_orphaned_schedules();
end;
$$;

-- Scenario A: EF crash after claim, before attempt row → uncertain orphan → IN_ANALYSIS.
do $seed_a$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_fixture record;
begin
  perform pg_temp.payment_seed_provider_gateway(v_provider_id);
  select * into v_fixture
  from pg_temp.payment_seed_charge_fixture(gen_random_uuid(), v_provider_id);
  perform set_config('test.orphan.schedule_uncertain', v_fixture.schedule_id::text, true);
end;
$seed_a$;

select pg_temp.payment_set_service_role();

select is(
  jsonb_array_length(pg_temp.payment_claim_batch_once(1)),
  1,
  'claim batch acquires uncertain orphan fixture schedule'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.id = current_setting('test.orphan.schedule_uncertain')::uuid
  ),
  'PROCESSING',
  'claimed schedule is PROCESSING with active lease'
);

select ok(
  (
    select ps.locked_until > now()
    from public.payment_schedules ps
    where ps.id = current_setting('test.orphan.schedule_uncertain')::uuid
  ),
  'claim sets locked_until lease before gateway I/O'
);

update public.payment_schedules ps
set locked_until = now() - interval '1 minute'
where ps.id = current_setting('test.orphan.schedule_uncertain')::uuid;

select is(
  (select recovered_count from pg_temp.payment_recover_orphans_once()),
  1,
  'janitor recovers one expired PROCESSING lease'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.id = current_setting('test.orphan.schedule_uncertain')::uuid
  ),
  'IN_ANALYSIS',
  'uncertain orphan (no attempt row) → IN_ANALYSIS for reconcile'
);

select ok(
  (
    select ps.locked_until is null
    from public.payment_schedules ps
    where ps.id = current_setting('test.orphan.schedule_uncertain')::uuid
  ),
  'janitor clears locked_until after recovery'
);

select ok(
  (
    select exists (
      select 1
      from public.payment_audit_log pal
      where pal.schedule_id = current_setting('test.orphan.schedule_uncertain')::uuid
        and pal.event_type = 'ORPHAN_RECOVERED'
        and pal.from_state = 'PROCESSING'
        and pal.to_state = 'IN_ANALYSIS'
    )
  ),
  'ORPHAN_RECOVERED audit entry written for uncertain orphan'
);

-- Scenario B: EF crash after attempt row persisted → retryable FAILED.
do $seed_b$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_fixture record;
begin
  select * into v_fixture
  from pg_temp.payment_seed_charge_fixture(gen_random_uuid(), v_provider_id);
  perform set_config('test.orphan.schedule_retryable', v_fixture.schedule_id::text, true);
end;
$seed_b$;

select pg_temp.payment_set_service_role();

select is(
  jsonb_array_length(pg_temp.payment_claim_batch_once(1)),
  1,
  'claim batch acquires retryable orphan fixture schedule'
);

insert into public.payment_attempts (
  schedule_id,
  attempt_number,
  initiator,
  charge_amount
)
select
  ps.id,
  ps.automatic_attempt_count,
  'cron'::public.payment_attempt_initiator,
  100.00
from public.payment_schedules ps
where ps.id = current_setting('test.orphan.schedule_retryable')::uuid;

update public.payment_schedules ps
set locked_until = now() - interval '1 minute'
where ps.id = current_setting('test.orphan.schedule_retryable')::uuid;

select is(
  (select recovered_to_failed from pg_temp.payment_recover_orphans_once()),
  1,
  'janitor reports retryable orphan recovered to FAILED'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.id = current_setting('test.orphan.schedule_retryable')::uuid
  ),
  'FAILED',
  'attempt row present without gateway_charge_id → FAILED retry path'
);

select ok(
  (
    select ps.next_retry_at is not null
    from public.payment_schedules ps
    where ps.id = current_setting('test.orphan.schedule_retryable')::uuid
  ),
  'FAILED orphan schedules next_retry_at for cron pickup'
);

-- Scenario C: janitor recovery then cron re-claim after retry window.
do $seed_c$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_fixture record;
begin
  select * into v_fixture
  from pg_temp.payment_seed_charge_fixture(gen_random_uuid(), v_provider_id);
  perform set_config('test.orphan.schedule_reclaim', v_fixture.schedule_id::text, true);
end;
$seed_c$;

select pg_temp.payment_set_service_role();

select is(
  jsonb_array_length(pg_temp.payment_claim_batch_once(1)),
  1,
  'claim batch acquires reclaim fixture schedule'
);

insert into public.payment_attempts (
  schedule_id,
  attempt_number,
  initiator,
  charge_amount
)
select
  ps.id,
  ps.automatic_attempt_count,
  'cron'::public.payment_attempt_initiator,
  100.00
from public.payment_schedules ps
where ps.id = current_setting('test.orphan.schedule_reclaim')::uuid;

update public.payment_schedules ps
set locked_until = now() - interval '1 minute'
where ps.id = current_setting('test.orphan.schedule_reclaim')::uuid;

select is(
  (select recovered_count from pg_temp.payment_recover_orphans_once()),
  1,
  'janitor recovers reclaim fixture orphan'
);

update public.payment_schedules ps
set next_retry_at = now() - interval '1 minute'
where ps.id = current_setting('test.orphan.schedule_reclaim')::uuid;

select is(
  jsonb_array_length(pg_temp.payment_claim_batch_once(1)),
  1,
  'cron re-claims schedule after janitor recovery and retry window'
);

select finish();

rollback;
