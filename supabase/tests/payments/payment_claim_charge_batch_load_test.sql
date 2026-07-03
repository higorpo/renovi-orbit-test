-- pgTAP: payment Task 99 — payment_claim_charge_batch load at batch_size 10 (Req 10.9, 23.1).

begin;

select plan(6);

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

create or replace function pg_temp.payment_claim_batch_once(p_batch_size int default 10)
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
  p_provider_id uuid
)
returns uuid
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
    format('claim batch load %s', p_contracted_service_id),
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
    'claim batch load proposal', 1, 'days', jsonb_build_array(v_slot),
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
    'Claim Batch Load', '{}'::jsonb, 'ACTIVE'::public.payment_client_card_token_state
  );

  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    client_card_token_id, installment_number, base_amount, commission_rate_pct,
    provider_payout, charge_scheduled_at, state, idempotency_key
  )
  values (
    v_schedule_id, p_contracted_service_id, v_client_id, p_provider_id, 'netcred',
    v_card_token_id, 1, 100.00, 10.00, 90.00, now() - interval '1 minute',
    'SCHEDULED'::public.payment_schedule_state, p_contracted_service_id::text
  );

  return v_schedule_id;
end;
$$;

do $seed$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_schedule_ids uuid[] := '{}'::uuid[];
  v_schedule_id uuid;
  i int;
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

  for i in 1..15 loop
    v_schedule_id := pg_temp.payment_seed_charge_fixture(gen_random_uuid(), v_provider_id);
    v_schedule_ids := array_append(v_schedule_ids, v_schedule_id);
  end loop;

  perform set_config(
    'test.claim_batch.schedule_ids',
    array_to_string(v_schedule_ids, ','),
    true
  );
end;
$seed$;

select pg_temp.payment_set_service_role();

select is(
  jsonb_array_length(pg_temp.payment_claim_batch_once(10)),
  10,
  'batch_size 10 claims exactly ten schedules when fifteen are eligible'
);

select is(
  jsonb_array_length(pg_temp.payment_claim_batch_once(10)),
  5,
  'second batch_size 10 claim acquires remaining five eligible schedules'
);

select is(
  (
    select count(*)::int
    from public.payment_schedules ps
    where ps.id = any(string_to_array(current_setting('test.claim_batch.schedule_ids'), ',')::uuid[])
      and ps.state = 'PROCESSING'::public.payment_schedule_state
  ),
  15,
  'all seeded schedules transition to PROCESSING without duplicate leases'
);

select is(
  (
    select count(distinct ps.id)::int
    from public.payment_schedules ps
    where ps.id = any(string_to_array(current_setting('test.claim_batch.schedule_ids'), ',')::uuid[])
      and ps.state = 'PROCESSING'::public.payment_schedule_state
  ),
  15,
  'each schedule_id is leased at most once across two batch claims'
);

select ok(
  (
    select bool_and(ps.automatic_attempt_count = 1)
    from public.payment_schedules ps
    where ps.id = any(string_to_array(current_setting('test.claim_batch.schedule_ids'), ',')::uuid[])
      and ps.state = 'PROCESSING'::public.payment_schedule_state
  ),
  'automatic_attempt_count increments once per claimed schedule'
);

select is(
  jsonb_array_length(pg_temp.payment_claim_batch_once(10)),
  0,
  'third batch_size 10 claim returns empty when no eligible schedules remain'
);

select finish();

rollback;
