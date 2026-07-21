-- pgTAP: payment Task 120 — IN_ANALYSIS exclusion before T-12h (Req 14.4).

begin;

select plan(7);

create or replace function pg_temp.payment120_set_service_role()
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

select pg_temp.payment120_set_service_role();

create or replace function pg_temp.payment120_seed_inanalysis_future_service(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_scheduled_start_date date
)
returns table (
  schedule_id uuid,
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
  v_schedule_id uuid := gen_random_uuid();
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
    format('inanalysis before t12h pgTAP %s', p_contracted_service_id),
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

  perform pg_temp.payment120_set_service_role();

  v_slot := jsonb_build_object(
    'start_date', to_char(p_scheduled_start_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, p_provider_id, v_service_request_id, v_pricing.original_amount,
    'inanalysis before t12h pgTAP proposal', 2, 'hours', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_shift,
    agreed_slot, status
  )
  values (
    p_contracted_service_id, v_service_request_id, v_proposal_id, v_client_id,
    p_provider_id, 'hours', 2, p_scheduled_start_date, 'morning', v_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key,
    gateway_reference_code)
  values (
    v_schedule_id, p_contracted_service_id, v_client_id, p_provider_id,
    'netcred', 1, 100.00, 10.00, 90.00,
    now(), 'IN_ANALYSIS'::public.payment_schedule_state, p_contracted_service_id::text,
    p_contracted_service_id);

  schedule_id := v_schedule_id;
  client_id := v_client_id;
  return next;
end;
$$;

do $seed$
declare
  v_service_id uuid := gen_random_uuid();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_fixture record;
begin
  select * into v_fixture
  from pg_temp.payment120_seed_inanalysis_future_service(
    v_service_id,
    v_provider_id,
    current_date + 3
  );

  perform set_config('test.auto_cancel120.service', v_service_id::text, true);
  perform set_config('test.auto_cancel120.schedule', v_fixture.schedule_id::text, true);
end;
$seed$;

select ok(
  (
    select cs.service_execution_at - now() > make_interval(hours => 12)
    from public.contracted_services cs
    where cs.id = current_setting('test.auto_cancel120.service')::uuid
  ),
  'fixture execution_at is more than 12 hours away'
);

select lives_ok(
  $$ select public.payment_auto_cancel_services() $$,
  'auto-cancel batch runs without error for future IN_ANALYSIS schedule'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    where cs.id = current_setting('test.auto_cancel120.service')::uuid
  ),
  'PENDING_PAYMENT',
  'service remains PENDING_PAYMENT before T-12h'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.id = current_setting('test.auto_cancel120.schedule')::uuid
  ),
  'IN_ANALYSIS',
  'schedule remains IN_ANALYSIS before T-12h'
);

select is(
  (
    select count(*)::int
    from jsonb_array_elements(
      (select public.payment_auto_cancel_services()->'cancelled')
    ) item
    where item->>'service_id' = current_setting('test.auto_cancel120.service')
  ),
  0,
  'IN_ANALYSIS future service is excluded from cancelled payload'
);

select is(
  (
    select count(*)::int
    from public.payment_audit_log pal
    where pal.event_type = 'AUTO_CANCELLED'
      and pal.schedule_id = current_setting('test.auto_cancel120.schedule')::uuid
  ),
  0,
  'no AUTO_CANCELLED audit row is written before T-12h'
);

select is(
  (
    select count(*)::int
    from public.payment_events pe
    where pe.event_type = 'ServiceAutoCancelled'
      and pe.aggregate_id = current_setting('test.auto_cancel120.schedule')::uuid
  ),
  0,
  'no ServiceAutoCancelled event is emitted before T-12h'
);

select finish();
rollback;
