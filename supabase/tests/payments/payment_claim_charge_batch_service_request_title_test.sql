-- pgTAP: payment_claim_charge_batch returns service_request_title for claimed rows.

begin;

select plan(1);

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
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.service_requests (
    id,
    client_id,
    service_id,
    address_id,
    title,
    description,
    form_data,
    form_version,
    status,
    urgency
  )
  select
    v_service_request_id,
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'Instalação elétrica residencial',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
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
    id,
    provider_id,
    service_request_id,
    proposed_amount,
    proposal_description,
    proposal_duration_value,
    proposal_duration_unit,
    proposal_suggested_slots,
    photos,
    tax_rate,
    tax_amount,
    final_amount,
    pricing_signature,
    status
  )
  values (
    v_proposal_id,
    v_provider_id,
    v_service_request_id,
    v_pricing.original_amount,
    'pgTAP charge batch title',
    1,
    'days',
    jsonb_build_array(v_slot),
    '{}'::text[],
    v_pricing.tax_rate,
    v_pricing.tax_amount,
    v_pricing.final_amount,
    v_pricing.pricing_signature,
    'ACCEPTED'::public.proposal_status
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
    scheduled_end_date,
    scheduled_shift,
    agreed_slot,
    status
  )
  values (
    v_contracted_service_id,
    v_service_request_id,
    v_proposal_id,
    v_client_id,
    v_provider_id,
    'days',
    1,
    current_date + 5,
    current_date + 5,
    'morning',
    v_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  insert into public.client_card_tokens (
    id,
    client_id,
    gateway_slug,
    gateway_payment_profile_id, netcred_company_id,
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
    v_card_token_id,
    v_client_id,
    'netcred',
    format('profile-%s', v_contracted_service_id), '1014',
    '497010XXXXXX0048',
    'visa',
    format('token-%s', v_contracted_service_id),
    12,
    2030,
    'Charge Batch Title Test',
    '{}'::jsonb,
    'ACTIVE'::public.payment_client_card_token_state
  );

  insert into public.payment_schedules (
    id,
    contracted_service_id,
    client_id,
    provider_id,
    gateway_slug,
    client_card_token_id,
    installment_number,
    base_amount,
    commission_rate_pct,
    provider_payout,
    charge_scheduled_at,
    state,
    idempotency_key,
    gateway_reference_code)
  values (
    v_schedule_id,
    v_contracted_service_id,
    v_client_id,
    v_provider_id,
    'netcred',
    v_card_token_id,
    1,
    100.00,
    10.00,
    90.00,
    now() - interval '1 minute',
    'SCHEDULED'::public.payment_schedule_state,
    v_contracted_service_id::text,
    v_contracted_service_id);

  perform set_config('test.charge_batch.schedule_id', v_schedule_id::text, true);
end;
$seed$;

select is(
  (
    select elem->>'service_request_title'
    from jsonb_array_elements(public.payment_claim_charge_batch(1)) elem
    where elem->>'id' = current_setting('test.charge_batch.schedule_id')
    limit 1
  ),
  'Instalação elétrica residencial',
  'payment_claim_charge_batch returns service_request_title'
);

select * from finish();
rollback;
