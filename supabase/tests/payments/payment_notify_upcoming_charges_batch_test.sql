-- pgTAP: payment Task 45 — payment_notify_upcoming_charges_batch claim and dedupe.

begin;

select plan(8);

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

select throws_ok(
  $$ select public.payment_notify_upcoming_charges_batch() $$,
  '42501',
  'service_role required for payment_notify_upcoming_charges_batch',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

create or replace function pg_temp.payment_seed_contracted_service_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_scheduled_start_date date,
  p_service_status public.contracted_service_status default 'PENDING_PAYMENT'
)
returns table (
  service_request_id uuid,
  proposal_id uuid,
  client_id uuid
)
language plpgsql
as $$
declare
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
    format('notify upcoming charges pgTAP %s', p_contracted_service_id),
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN',
    sr.urgency
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

  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);

  v_slot := jsonb_build_object(
    'start_date', to_char(p_scheduled_start_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

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
    p_provider_id,
    v_service_request_id,
    v_pricing.original_amount,
    'notify upcoming charges pgTAP proposal',
    2,
    'hours',
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
    scheduled_shift,
    agreed_slot,
    status
  )
  values (
    p_contracted_service_id,
    v_service_request_id,
    v_proposal_id,
    v_client_id,
    p_provider_id,
    'hours',
    2,
    p_scheduled_start_date,
    'morning',
    v_slot,
    p_service_status
  );

  service_request_id := v_service_request_id;
  proposal_id := v_proposal_id;
  client_id := v_client_id;
  return next;
end;
$$;

do $seed$
declare
  v_token_id uuid := gen_random_uuid();
  v_cs_eligible uuid := gen_random_uuid();
  v_cs_notified uuid := gen_random_uuid();
  v_cs_future uuid := gen_random_uuid();
  v_cs_emergency uuid := gen_random_uuid();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_fixture record;
  v_client_id uuid;
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.client_card_tokens (
    id,
    client_id,
    gateway_slug,
    gateway_payment_profile_id, netcred_company_id,
    gateway_card_token,
    card_brand,
    card_number_masked,
    expiry_month,
    expiry_year,
    cardholder_name,
    billing_address,
    state
  )
  values (
    v_token_id,
    v_client_id,
    'netcred',
    'profile-notify-test', '1014',
    'token-notify-test',
    'visa',
    '****4242',
    12,
    2030,
    'Test Client',
    '{"street":"Rua Teste","number":"1","city":"Florianópolis","state":"SC","zipCode":"88000000"}'::jsonb,
    'ACTIVE'::public.payment_client_card_token_state
  );

  select * into v_fixture
  from pg_temp.payment_seed_contracted_service_fixture(
    v_cs_eligible,
    v_provider_id,
    current_date + 2
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    client_card_token_id, installment_number, base_amount,
    commission_rate_pct, provider_payout, charge_scheduled_at, state,
    idempotency_key,
    gateway_reference_code)
  values (
    v_cs_eligible, v_fixture.client_id, v_provider_id, 'netcred',
    v_token_id, 1, 100.00, 10.00, 90.00,
    now() + interval '12 hours',
    'SCHEDULED'::public.payment_schedule_state,
    v_cs_eligible::text,
    v_cs_eligible);

  select * into v_fixture
  from pg_temp.payment_seed_contracted_service_fixture(
    v_cs_notified,
    v_provider_id,
    current_date + 2
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    client_card_token_id, installment_number, base_amount,
    commission_rate_pct, provider_payout, charge_scheduled_at, state,
    idempotency_key, upcoming_charge_notified_at,
    gateway_reference_code)
  values (
    v_cs_notified, v_fixture.client_id, v_provider_id, 'netcred',
    v_token_id, 1, 100.00, 10.00, 90.00,
    now() + interval '12 hours',
    'SCHEDULED'::public.payment_schedule_state,
    v_cs_notified::text,
    now(),
    v_cs_notified);

  select * into v_fixture
  from pg_temp.payment_seed_contracted_service_fixture(
    v_cs_future,
    v_provider_id,
    current_date + 5
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    client_card_token_id, installment_number, base_amount,
    commission_rate_pct, provider_payout, charge_scheduled_at, state,
    idempotency_key,
    gateway_reference_code)
  values (
    v_cs_future, v_fixture.client_id, v_provider_id, 'netcred',
    v_token_id, 1, 100.00, 10.00, 90.00,
    now() + interval '3 days',
    'SCHEDULED'::public.payment_schedule_state,
    v_cs_future::text,
    v_cs_future);

  select * into v_fixture
  from pg_temp.payment_seed_contracted_service_fixture(
    v_cs_emergency,
    v_provider_id,
    current_date
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    client_card_token_id, installment_number, base_amount,
    commission_rate_pct, provider_payout, charge_scheduled_at, state,
    idempotency_key,
    gateway_reference_code)
  values (
    v_cs_emergency, v_fixture.client_id, v_provider_id, 'netcred',
    v_token_id, 1, 100.00, 10.00, 90.00,
    now() + interval '30 minutes',
    'SCHEDULED'::public.payment_schedule_state,
    v_cs_emergency::text,
    v_cs_emergency);

  perform set_config('test.notify.eligible', v_cs_eligible::text, true);
  perform set_config('test.notify.notified', v_cs_notified::text, true);
  perform set_config('test.notify.future', v_cs_future::text, true);
  perform set_config('test.notify.emergency', v_cs_emergency::text, true);
end;
$seed$;

create temp table _notify_result as
select public.payment_notify_upcoming_charges_batch() as payload;

select ok(
  (
    select ps.upcoming_charge_notified_at is null
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.notify.eligible')::uuid
  ),
  'batch claim does not set upcoming_charge_notified_at before MMD confirm'
);

select is(
  (
    select (payload->>'candidate_count')::int
    from _notify_result
  ),
  1,
  'returns exactly one eligible schedule candidate in first batch run'
);

select ok(
  public.payment_confirm_upcoming_charge_notified(
    (
      select ps.id
      from public.payment_schedules ps
      where ps.contracted_service_id = current_setting('test.notify.eligible')::uuid
    )
  ),
  'confirm marks upcoming_charge_notified_at after enqueue'
);

select ok(
  (
    select ps.upcoming_charge_notified_at is not null
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.notify.eligible')::uuid
  ),
  'eligible schedule is marked after confirm RPC'
);

select ok(
  (
    select count(*)::int
    from jsonb_array_elements(
      (select public.payment_notify_upcoming_charges_batch()->'candidates')
    ) item
    where item->>'service_id' = current_setting('test.notify.notified')
  ) = 0,
  'skips schedules already marked upcoming_charge_notified_at'
);

select ok(
  (
    select ps.upcoming_charge_notified_at is null
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.notify.future')::uuid
  ),
  'does not claim schedules outside 24h pre-charge window'
);

select ok(
  (
    select ps.upcoming_charge_notified_at is null
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.notify.emergency')::uuid
  ),
  'does not claim emergency schedules charging within one hour'
);

select * from finish();
rollback;
