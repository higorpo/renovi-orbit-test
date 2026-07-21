-- pgTAP: CHK-006 — commit validates claimed_charge_amount after fee-table change.

begin;

select plan(3);

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

select pg_temp.payment_set_service_role();

do $seed$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_contracted_service_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_pricing record;
  v_slot jsonb;
  v_card_token_id uuid := gen_random_uuid();
  v_schedule_id uuid := gen_random_uuid();
  v_claimed jsonb;
  v_claimed_amount numeric;
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description,
    form_data, form_version, status, urgency
  )
  select
    v_service_request_id, sr.client_id, sr.service_id, sr.address_id,
    'commit claim freeze pgTAP',
    sr.description, sr.form_data, sr.form_version,
    'OPEN'::public.service_request_status, sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date + 5, 'YYYY-MM-DD'),
    'end_date', to_char(current_date + 5, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  perform set_config('request.jwt.claim.sub', v_provider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_provider_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into strict v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  perform pg_temp.payment_set_service_role();

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, v_provider_id, v_service_request_id, v_pricing.original_amount,
    'commit claim freeze', 1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date,
    scheduled_shift, agreed_slot, status
  )
  values (
    v_contracted_service_id, v_service_request_id, v_proposal_id, v_client_id,
    v_provider_id, 'days', 1, current_date + 5, current_date + 5, 'morning', v_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  insert into public.client_card_tokens (
    id, client_id, gateway_slug, gateway_payment_profile_id, netcred_company_id, card_number_masked,
    card_brand, gateway_card_token, expiry_month, expiry_year, cardholder_name,
    billing_address, state
  )
  values (
    v_card_token_id, v_client_id, 'netcred',
    format('profile-%s', v_contracted_service_id),
    '1014',
    '497010XXXXXX0048', 'visa', format('token-%s', v_contracted_service_id),
    12, 2030, 'Claim Freeze Test', '{}'::jsonb,
    'ACTIVE'::public.payment_client_card_token_state
  );

  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    client_card_token_id, installment_number, base_amount, commission_rate_pct,
    provider_payout, charge_scheduled_at, state, idempotency_key,
    gateway_reference_code
  )
  values (
    v_schedule_id, v_contracted_service_id, v_client_id, v_provider_id, 'netcred',
    v_card_token_id, 1, 100.00, 10.00, 90.00,
    now() - interval '1 minute',
    'SCHEDULED'::public.payment_schedule_state,
    v_contracted_service_id::text,
    v_contracted_service_id
  );

  v_claimed := public.payment_claim_charge_batch(1);
  v_claimed_amount := (v_claimed->0->>'charge_amount')::numeric;

  perform set_config('test.claim_freeze.schedule_id', v_schedule_id::text, true);
  perform set_config('test.claim_freeze.amount', v_claimed_amount::text, true);

  -- Mutate live fee table after claim freezes amount A.
  update public.platform_constants
  set value = '99.99'::jsonb
  where key = 'cc_elo_other_1x_rate';
end;
$seed$;

select ok(
  current_setting('test.claim_freeze.amount')::numeric > 0,
  'claim batch froze a positive charge_amount'
);

select lives_ok(
  format(
    $$ select public.payment_commit_charge_outcome(
      %L::uuid,
      'PAID',
      %s::numeric,
      'gw-charge-freeze-1',
      'gw-tx-freeze-1'
    ) $$,
    current_setting('test.claim_freeze.schedule_id'),
    current_setting('test.claim_freeze.amount')
  ),
  'commit of claimed amount A succeeds after fee-table mutation'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.id = current_setting('test.claim_freeze.schedule_id')::uuid
  ),
  'PAID',
  'schedule transitions to PAID using frozen claim amount'
);

select * from finish();

rollback;
