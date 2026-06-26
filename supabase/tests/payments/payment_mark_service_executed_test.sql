-- pgTAP: payment Task 48 — payment_mark_service_executed provider date gate.

begin;

select plan(4);

create or replace function pg_temp.payment_set_provider_auth(p_user_id uuid)
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

create or replace function pg_temp.payment_seed_contracted_service_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_scheduled_start_date date,
  p_service_status public.contracted_service_status default 'CONFIRMED'
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
    format('mark executed pgTAP %s', p_contracted_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform pg_temp.payment_set_provider_auth(p_provider_id);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

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
    'mark executed pgTAP proposal', 2, 'hours', jsonb_build_array(v_slot),
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
    p_service_status
  );

  service_request_id := v_service_request_id;
  proposal_id := v_proposal_id;
  client_id := v_client_id;
  return next;
end;
$$;

select throws_ok(
  $$ select public.payment_mark_service_executed(gen_random_uuid()) $$,
  '42501',
  'Authentication required for payment_mark_service_executed',
  'rejects unauthenticated callers'
);

select pg_temp.payment_set_provider_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

do $seed$
declare
  v_future_id uuid := gen_random_uuid();
  v_pending_id uuid := gen_random_uuid();
  v_ok_id uuid := gen_random_uuid();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_fixture record;
begin
  perform pg_temp.payment_seed_contracted_service_fixture(
    v_future_id,
    v_provider_id,
    current_date + 3,
    'CONFIRMED'::public.contracted_service_status
  );

  perform pg_temp.payment_seed_contracted_service_fixture(
    v_pending_id,
    v_provider_id,
    current_date,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  select * into v_fixture
  from pg_temp.payment_seed_contracted_service_fixture(
    v_ok_id,
    v_provider_id,
    current_date,
    'CONFIRMED'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, paid_at
  )
  values (
    v_ok_id, v_fixture.client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00,
    now() - interval '24 hours',
    'PAID'::public.payment_schedule_state,
    v_ok_id::text,
    now() - interval '24 hours'
  );

  perform set_config('test.mark_executed.future', v_future_id::text, true);
  perform set_config('test.mark_executed.pending', v_pending_id::text, true);
  perform set_config('test.mark_executed.ok', v_ok_id::text, true);
end;
$seed$;

select throws_ok(
  $$ select public.payment_mark_service_executed(
    current_setting('test.mark_executed.future')::uuid
  ) $$,
  'P0002',
  'SERVICE_NOT_YET_DUE',
  'future scheduled_start_date raises SERVICE_NOT_YET_DUE'
);

select throws_ok(
  $$ select public.payment_mark_service_executed(
    current_setting('test.mark_executed.pending')::uuid
  ) $$,
  'P0001',
  'INVALID_STATUS_TRANSITION',
  'non-CONFIRMED status raises INVALID_STATUS_TRANSITION'
);

select is(
  public.payment_mark_service_executed(
    current_setting('test.mark_executed.ok')::uuid
  )->>'status',
  'EXECUTED',
  'CONFIRMED service on scheduled date marks EXECUTED'
);

select * from finish();
rollback;
