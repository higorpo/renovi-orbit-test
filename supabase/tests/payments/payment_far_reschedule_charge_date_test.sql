-- pgTAP: payment_reschedule_charge_date near vs far post-PAID + pre-PAID.
-- Far threshold is anchored on paid_at (settlement clock), not now().

begin;

select plan(12);

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
  $$ select public.payment_reschedule_charge_date(gen_random_uuid()) $$,
  '42501',
  'service_role required for payment_reschedule_charge_date',
  'rejects non-service_role callers'
);

do $seed$
declare
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_near_cs uuid := gen_random_uuid();
  v_far_cs uuid := gen_random_uuid();
  v_pre_cs uuid := gen_random_uuid();
  v_boundary_cs uuid := gen_random_uuid();
  v_stale_paid_cs uuid := gen_random_uuid();
  v_sr uuid;
  v_proposal uuid;
  v_pricing record;
  v_near_date date := (current_date + 7);
  v_far_date date := (current_date + 20);
  v_boundary_date date := (current_date + 14);
  -- Only ~10d from now, but ~20d after paid_at → far when anchored on paid_at
  v_stale_paid_date date := (current_date + 10);
  v_slot jsonb;
begin
  select sr.client_id into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform set_config('request.jwt.claim.sub', v_provider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_provider_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into v_pricing
  from public.calculate_provider_service_pricing(800.00::numeric);

  perform pg_temp.payment_set_service_role();

  -- Near PAID
  v_sr := gen_random_uuid();
  v_proposal := gen_random_uuid();
  v_slot := jsonb_build_object('start_date', to_char(v_near_date, 'YYYY-MM-DD'), 'shift', 'morning');
  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select v_sr, sr.client_id, sr.service_id, sr.address_id, 'far-recapture near',
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  ) values (
    v_proposal, v_provider_id, v_sr, v_pricing.original_amount, 'near', 1, 'days',
    jsonb_build_array(v_slot), '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount,
    v_pricing.final_amount, v_pricing.pricing_signature, 'ACCEPTED'
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  ) values (
    v_near_cs, v_sr, v_proposal, v_client_id, v_provider_id, 'days', 1,
    v_near_date, v_near_date, 'morning', v_slot, 'CONFIRMED'
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, installment_number,
    base_amount, commission_rate_pct, provider_payout, charge_scheduled_at, state,
    idempotency_key, gateway_reference_code, paid_at, paid_amount, gateway_transaction_id
  ) values (
    v_near_cs, v_client_id, v_provider_id, 1, 800.00, 15.00, 680.00,
    now() - interval '1 day', 'PAID', v_near_cs::text, v_near_cs,
    now() - interval '1 day', 820.00, 'txn-near'
  );

  -- Far PAID
  v_sr := gen_random_uuid();
  v_proposal := gen_random_uuid();
  v_slot := jsonb_build_object('start_date', to_char(v_far_date, 'YYYY-MM-DD'), 'shift', 'morning');
  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select v_sr, sr.client_id, sr.service_id, sr.address_id, 'far-recapture far',
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  ) values (
    v_proposal, v_provider_id, v_sr, v_pricing.original_amount, 'far', 1, 'days',
    jsonb_build_array(v_slot), '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount,
    v_pricing.final_amount, v_pricing.pricing_signature, 'ACCEPTED'
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  ) values (
    v_far_cs, v_sr, v_proposal, v_client_id, v_provider_id, 'days', 1,
    v_far_date, v_far_date, 'morning', v_slot, 'CONFIRMED'
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, installment_number,
    base_amount, commission_rate_pct, provider_payout, charge_scheduled_at, state,
    idempotency_key, gateway_reference_code, paid_at, paid_amount, gateway_transaction_id
  ) values (
    v_far_cs, v_client_id, v_provider_id, 1, 800.00, 15.00, 680.00,
    now() - interval '1 day', 'PAID', v_far_cs::text, v_far_cs,
    now() - interval '1 day', 820.00, 'txn-far'
  );

  -- Pre-PAID far date
  v_sr := gen_random_uuid();
  v_proposal := gen_random_uuid();
  v_slot := jsonb_build_object('start_date', to_char(v_far_date, 'YYYY-MM-DD'), 'shift', 'morning');
  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select v_sr, sr.client_id, sr.service_id, sr.address_id, 'far-recapture pre',
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  ) values (
    v_proposal, v_provider_id, v_sr, v_pricing.original_amount, 'pre', 1, 'days',
    jsonb_build_array(v_slot), '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount,
    v_pricing.final_amount, v_pricing.pricing_signature, 'ACCEPTED'
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  ) values (
    v_pre_cs, v_sr, v_proposal, v_client_id, v_provider_id, 'days', 1,
    v_far_date, v_far_date, 'morning', v_slot, 'PENDING_PAYMENT'
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, installment_number,
    base_amount, commission_rate_pct, provider_payout, charge_scheduled_at, state,
    idempotency_key, gateway_reference_code
  ) values (
    v_pre_cs, v_client_id, v_provider_id, 1, 800.00, 15.00, 680.00,
    now() + interval '1 day', 'SCHEDULED', v_pre_cs::text, v_pre_cs
  );

  -- Boundary: ~14d after paid_at → near (strict > threshold for far)
  v_sr := gen_random_uuid();
  v_proposal := gen_random_uuid();
  v_slot := jsonb_build_object('start_date', to_char(v_boundary_date, 'YYYY-MM-DD'), 'shift', 'morning');
  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select v_sr, sr.client_id, sr.service_id, sr.address_id, 'far-recapture boundary',
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  ) values (
    v_proposal, v_provider_id, v_sr, v_pricing.original_amount, 'boundary', 1, 'days',
    jsonb_build_array(v_slot), '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount,
    v_pricing.final_amount, v_pricing.pricing_signature, 'ACCEPTED'
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  ) values (
    v_boundary_cs, v_sr, v_proposal, v_client_id, v_provider_id, 'days', 1,
    v_boundary_date, v_boundary_date, 'morning', v_slot, 'CONFIRMED'
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, installment_number,
    base_amount, commission_rate_pct, provider_payout, charge_scheduled_at, state,
    idempotency_key, gateway_reference_code, paid_at, paid_amount, gateway_transaction_id
  ) values (
    v_boundary_cs, v_client_id, v_provider_id, 1, 800.00, 15.00, 680.00,
    now() - interval '1 day', 'PAID', v_boundary_cs::text, v_boundary_cs,
    now() - interval '1 day', 820.00, 'txn-boundary'
  );

  -- Stale paid_at: exec only ~10d from now, but >15d after paid_at → far
  v_sr := gen_random_uuid();
  v_proposal := gen_random_uuid();
  v_slot := jsonb_build_object('start_date', to_char(v_stale_paid_date, 'YYYY-MM-DD'), 'shift', 'morning');
  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select v_sr, sr.client_id, sr.service_id, sr.address_id, 'far-recapture stale paid',
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  ) values (
    v_proposal, v_provider_id, v_sr, v_pricing.original_amount, 'stale-paid', 1, 'days',
    jsonb_build_array(v_slot), '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount,
    v_pricing.final_amount, v_pricing.pricing_signature, 'ACCEPTED'
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  ) values (
    v_stale_paid_cs, v_sr, v_proposal, v_client_id, v_provider_id, 'days', 1,
    v_stale_paid_date, v_stale_paid_date, 'morning', v_slot, 'CONFIRMED'
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, installment_number,
    base_amount, commission_rate_pct, provider_payout, charge_scheduled_at, state,
    idempotency_key, gateway_reference_code, paid_at, paid_amount, gateway_transaction_id
  ) values (
    v_stale_paid_cs, v_client_id, v_provider_id, 1, 800.00, 15.00, 680.00,
    now() - interval '10 days', 'PAID', v_stale_paid_cs::text, v_stale_paid_cs,
    now() - interval '10 days', 820.00, 'txn-stale-paid'
  );

  perform set_config('test.far.near_cs', v_near_cs::text, true);
  perform set_config('test.far.far_cs', v_far_cs::text, true);
  perform set_config('test.far.pre_cs', v_pre_cs::text, true);
  perform set_config('test.far.boundary_cs', v_boundary_cs::text, true);
  perform set_config('test.far.stale_paid_cs', v_stale_paid_cs::text, true);
end;
$seed$;

select pg_temp.payment_set_service_role();

select is(
  public.payment_reschedule_charge_date(current_setting('test.far.near_cs')::uuid)->>'outcome',
  'paid_no_charge_update',
  'PAID + exec ≤ paid_at+15d → paid_no_charge_update'
);

select is(
  (
    select ps.far_recapture_pending_at is null
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.far.near_cs')::uuid
  ),
  true,
  'near path does not set far_recapture_pending_at'
);

select is(
  public.payment_reschedule_charge_date(current_setting('test.far.far_cs')::uuid)->>'outcome',
  'paid_far_recapture_required',
  'PAID + exec > paid_at+15d → paid_far_recapture_required'
);

select ok(
  (
    select ps.far_recapture_pending_at is not null
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.far.far_cs')::uuid
  ),
  'far path sets far_recapture_pending_at'
);

select is(
  public.payment_reschedule_charge_date(current_setting('test.far.far_cs')::uuid)->>'outcome',
  'paid_far_recapture_required',
  'idempotent far call keeps paid_far_recapture_required'
);

select is(
  public.payment_reschedule_charge_date(current_setting('test.far.boundary_cs')::uuid)->>'outcome',
  'paid_no_charge_update',
  'boundary at ~14d after paid_at remains paid_no_charge_update'
);

select is(
  public.payment_reschedule_charge_date(current_setting('test.far.stale_paid_cs')::uuid)->>'outcome',
  'paid_far_recapture_required',
  'exec ~10d from now but >15d after paid_at → far (paid_at anchor)'
);

select is(
  public.payment_reschedule_charge_date(current_setting('test.far.pre_cs')::uuid)->>'outcome',
  'rescheduled',
  'pre-PAID far date retargets charge_scheduled_at without recapture pending'
);

select is(
  (
    select ps.far_recapture_pending_at is null
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.far.pre_cs')::uuid
  ),
  true,
  'pre-PAID far does not set far_recapture_pending_at'
);

select is(
  (
    select (pc.value #>> '{}')::int
    from public.platform_constants pc
    where pc.key = 'far_reschedule_recapture_threshold_days'
  ),
  15,
  'threshold constant seeded as 15'
);

select finish();

rollback;
