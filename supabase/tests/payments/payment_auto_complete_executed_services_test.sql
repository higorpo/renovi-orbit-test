-- pgTAP: payment Task 47 — payment_auto_complete_executed_services batch rules.

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
  $$ select public.payment_auto_complete_executed_services() $$,
  '42501',
  'service_role required for payment_auto_complete_executed_services',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

create or replace function pg_temp.payment_seed_contracted_service_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_scheduled_start_date date,
  p_service_status public.contracted_service_status default 'PENDING_PAYMENT',
  p_executed_at timestamptz default null,
  p_completed_at timestamptz default null,
  p_completed_by text default null
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
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select
    v_service_request_id, sr.client_id, sr.service_id, sr.address_id,
    format('auto complete pgTAP %s', p_contracted_service_id),
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
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, p_provider_id, v_service_request_id, v_pricing.original_amount,
    'auto complete pgTAP proposal', 2, 'hours', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_shift,
    agreed_slot, status, executed_at, completed_at, completed_by
  )
  values (
    p_contracted_service_id, v_service_request_id, v_proposal_id, v_client_id,
    p_provider_id, 'hours', 2, p_scheduled_start_date, 'morning', v_slot,
    p_service_status, p_executed_at, p_completed_at, p_completed_by
  );

  service_request_id := v_service_request_id;
  proposal_id := v_proposal_id;
  client_id := v_client_id;
  return next;
end;
$$;

do $seed$
declare
  v_cs_due uuid := gen_random_uuid();
  v_cs_recent uuid := gen_random_uuid();
  v_cs_completed uuid := gen_random_uuid();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_fixture record;
begin
  select * into v_fixture
  from pg_temp.payment_seed_contracted_service_fixture(
    v_cs_due,
    v_provider_id,
    current_date - 1,
    'EXECUTED'::public.contracted_service_status,
    now() - interval '25 hours'
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, paid_at
  )
  values (
    v_cs_due, v_fixture.client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00,
    now() - interval '48 hours',
    'PAID'::public.payment_schedule_state,
    v_cs_due::text,
    now() - interval '48 hours'
  );

  perform pg_temp.payment_seed_contracted_service_fixture(
    v_cs_recent,
    v_provider_id,
    current_date,
    'EXECUTED'::public.contracted_service_status,
    now() - interval '2 hours'
  );

  perform pg_temp.payment_seed_contracted_service_fixture(
    v_cs_completed,
    v_provider_id,
    current_date - 2,
    'COMPLETED'::public.contracted_service_status,
    now() - interval '30 hours',
    now() - interval '6 hours',
    'system'
  );

  perform set_config('test.autocomplete.due', v_cs_due::text, true);
  perform set_config('test.autocomplete.recent', v_cs_recent::text, true);
  perform set_config('test.autocomplete.completed', v_cs_completed::text, true);
end;
$seed$;

select lives_ok(
  $$ select public.payment_auto_complete_executed_services() $$,
  'payment_auto_complete_executed_services runs without error'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    where cs.id = current_setting('test.autocomplete.due')::uuid
  ),
  'COMPLETED',
  'EXECUTED service older than 24h is auto-completed'
);

select is(
  (
    select cs.completed_by
    from public.contracted_services cs
    where cs.id = current_setting('test.autocomplete.due')::uuid
  ),
  'system',
  'sets completed_by to system'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    where cs.id = current_setting('test.autocomplete.recent')::uuid
  ),
  'EXECUTED',
  'EXECUTED service within 24h is not auto-completed'
);

select ok(
  exists (
    select 1
    from public.payment_audit_log pal
    where pal.event_type = 'SERVICE_AUTO_COMPLETED'
      and pal.service_id = current_setting('test.autocomplete.due')::uuid
  ),
  'writes SERVICE_AUTO_COMPLETED audit row'
);

select is(
  (
    select count(*)::int
    from jsonb_array_elements(
      (select public.payment_auto_complete_executed_services()->'completed')
    ) item
    where item->>'service_id' = current_setting('test.autocomplete.completed')
  ),
  0,
  'already COMPLETED service is skipped idempotently'
);

select * from finish();
rollback;
