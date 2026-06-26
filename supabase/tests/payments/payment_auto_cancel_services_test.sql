-- pgTAP: payment Task 44 — payment_auto_cancel_services batch idempotency and IN_ANALYSIS rules.

begin;

select plan(7);

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
  $$ select public.payment_auto_cancel_services() $$,
  '42501',
  'service_role required for payment_auto_cancel_services',
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
    format('auto cancel pgTAP %s', p_contracted_service_id),
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
    'auto cancel pgTAP proposal',
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
  v_cs_failed uuid := gen_random_uuid();
  v_cs_analysis uuid := gen_random_uuid();
  v_cs_future_analysis uuid := gen_random_uuid();
  v_cs_cancelled uuid := gen_random_uuid();
  v_cs_suspended uuid := gen_random_uuid();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_provider_suspended uuid := '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid;
  v_fixture record;
begin
  select * into v_fixture
  from pg_temp.payment_seed_contracted_service_fixture(
    v_cs_failed,
    v_provider_id,
    current_date
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key
  )
  values (
    v_cs_failed, v_fixture.client_id, v_provider_id,
    'netcred', 1, 100.00, 10.00, 90.00,
    now(), 'FAILED'::public.payment_schedule_state, v_cs_failed::text
  );

  select * into v_fixture
  from pg_temp.payment_seed_contracted_service_fixture(
    v_cs_analysis,
    v_provider_id,
    current_date
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key
  )
  values (
    v_cs_analysis, v_fixture.client_id, v_provider_id,
    'netcred', 1, 100.00, 10.00, 90.00,
    now(), 'IN_ANALYSIS'::public.payment_schedule_state, v_cs_analysis::text
  );

  select * into v_fixture
  from pg_temp.payment_seed_contracted_service_fixture(
    v_cs_future_analysis,
    v_provider_id,
    current_date + 3
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key
  )
  values (
    v_cs_future_analysis, v_fixture.client_id, v_provider_id,
    'netcred', 1, 100.00, 10.00, 90.00,
    now(), 'IN_ANALYSIS'::public.payment_schedule_state, v_cs_future_analysis::text
  );

  select * into v_fixture
  from pg_temp.payment_seed_contracted_service_fixture(
    v_cs_cancelled,
    v_provider_id,
    current_date,
    'CANCELLED'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key
  )
  values (
    v_cs_cancelled, v_fixture.client_id, v_provider_id,
    'netcred', 1, 100.00, 10.00, 90.00,
    now(), 'FAILED'::public.payment_schedule_state, v_cs_cancelled::text
  );

  insert into public.provider_gateway_accounts (
    provider_id, gateway_slug, document, onboarding_status
  )
  values (
    v_provider_suspended,
    'netcred',
    '99988877766',
    'SUSPENDED'::public.payment_provider_onboarding_status
  )
  on conflict (provider_id, gateway_slug) do update
  set onboarding_status = 'SUSPENDED'::public.payment_provider_onboarding_status;

  select * into v_fixture
  from pg_temp.payment_seed_contracted_service_fixture(
    v_cs_suspended,
    v_provider_suspended,
    current_date
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key
  )
  values (
    v_cs_suspended, v_fixture.client_id, v_provider_suspended,
    'netcred', 1, 100.00, 10.00, 90.00,
    now(), 'FAILED'::public.payment_schedule_state, v_cs_suspended::text
  );

  perform set_config('test.auto_cancel.failed', v_cs_failed::text, true);
  perform set_config('test.auto_cancel.analysis', v_cs_analysis::text, true);
  perform set_config('test.auto_cancel.future_analysis', v_cs_future_analysis::text, true);
  perform set_config('test.auto_cancel.already', v_cs_cancelled::text, true);
  perform set_config('test.auto_cancel.suspended', v_cs_suspended::text, true);
end;
$seed$;

select lives_ok(
  $$ select public.payment_auto_cancel_services() $$,
  'payment_auto_cancel_services runs without error'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    where cs.id = current_setting('test.auto_cancel.failed')::uuid
  ),
  'CANCELLED',
  'eligible FAILED schedule is auto-cancelled at T-12h'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    where cs.id = current_setting('test.auto_cancel.analysis')::uuid
  ),
  'CANCELLED',
  'IN_ANALYSIS schedule is auto-cancelled when T-12h threshold reached'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    where cs.id = current_setting('test.auto_cancel.future_analysis')::uuid
  ),
  'PENDING_PAYMENT',
  'IN_ANALYSIS schedule before T-12h is not auto-cancelled'
);

select is(
  (
    select count(*)::int
    from jsonb_array_elements(
      (select public.payment_auto_cancel_services()->'cancelled')
    ) item
    where item->>'service_id' = current_setting('test.auto_cancel.already')
  ),
  0,
  'already-cancelled service is skipped idempotently on second run'
);

select is(
  (
    select cs.cancellation_reason
    from public.contracted_services cs
    where cs.id = current_setting('test.auto_cancel.suspended')::uuid
  ),
  'PROVIDER_SUSPENDED',
  'suspended provider gets PROVIDER_SUSPENDED cancellation reason'
);

select * from finish();
rollback;
