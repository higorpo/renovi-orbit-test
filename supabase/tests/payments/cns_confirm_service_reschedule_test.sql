-- pgTAP: payment Task 86 — cns_confirm_service_reschedule payment integration.

begin;

select plan(6);

create or replace function pg_temp.cns_set_auth(p_user_id uuid)
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

create or replace function pg_temp.cns_set_service_role()
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

create or replace function pg_temp.cns_seed_reschedule_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_service_status public.contracted_service_status default 'PENDING_PAYMENT'::public.contracted_service_status
)
returns table (
  service_request_id uuid,
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
    format('reschedule pgTAP %s', p_contracted_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform pg_temp.cns_set_auth(p_provider_id);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date + 10, 'YYYY-MM-DD'),
    'end_date', to_char(current_date + 10, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, p_provider_id, v_service_request_id, v_pricing.original_amount,
    'reschedule pgTAP proposal', 1, 'days', jsonb_build_array(v_slot),
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
    p_provider_id, 'days', 1, current_date + 10, current_date + 10, 'morning', v_slot,
    p_service_status
  );

  service_request_id := v_service_request_id;
  client_id := v_client_id;
  return next;
end;
$$;

select throws_ok(
  $$ select public.cns_confirm_service_reschedule(
    gen_random_uuid(),
    jsonb_build_object('start_date', '2099-01-01', 'shift', 'morning')
  ) $$,
  '42501',
  'Authentication required for cns_confirm_service_reschedule',
  'rejects unauthenticated callers'
);

do $seed$
declare
  v_pre_paid_id uuid := gen_random_uuid();
  v_post_paid_id uuid := gen_random_uuid();
  v_executed_id uuid := gen_random_uuid();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_client_id uuid;
  v_new_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date + 14, 'YYYY-MM-DD'),
    'end_date', to_char(current_date + 14, 'YYYY-MM-DD'),
    'shift', 'afternoon'
  );
begin
  select client_id into v_client_id
  from pg_temp.cns_seed_reschedule_fixture(
    v_pre_paid_id,
    v_provider_id,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key
  )
  values (
    v_pre_paid_id, v_client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00,
    now() + interval '5 days',
    'SCHEDULED'::public.payment_schedule_state,
    v_pre_paid_id::text
  );

  select client_id into v_client_id
  from pg_temp.cns_seed_reschedule_fixture(
    v_post_paid_id,
    v_provider_id,
    'CONFIRMED'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, paid_at
  )
  values (
    v_post_paid_id, v_client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00,
    now() - interval '1 day',
    'PAID'::public.payment_schedule_state,
    v_post_paid_id::text,
    now() - interval '1 day'
  );

  perform pg_temp.cns_seed_reschedule_fixture(
    v_executed_id,
    v_provider_id,
    'EXECUTED'::public.contracted_service_status
  );

  perform set_config('test.cns_reschedule.pre_paid', v_pre_paid_id::text, true);
  perform set_config('test.cns_reschedule.post_paid', v_post_paid_id::text, true);
  perform set_config('test.cns_reschedule.executed', v_executed_id::text, true);
  perform set_config('test.cns_reschedule.client_id', v_client_id::text, true);
  perform set_config('test.cns_reschedule.new_slot', v_new_slot::text, true);
end;
$seed$;

select pg_temp.cns_set_auth(current_setting('test.cns_reschedule.client_id')::uuid);

select throws_ok(
  format(
    $$ select public.cns_confirm_service_reschedule(
      %L::uuid,
      %L::jsonb
    ) $$,
    current_setting('test.cns_reschedule.executed')::uuid,
    current_setting('test.cns_reschedule.new_slot')::jsonb
  ),
  'P0001',
  'RESCHEDULE_NOT_ALLOWED',
  'rejects reschedule when service is EXECUTED'
);

select is(
  public.cns_confirm_service_reschedule(
    current_setting('test.cns_reschedule.pre_paid')::uuid,
    current_setting('test.cns_reschedule.new_slot')::jsonb
  )->'payment'->>'outcome',
  'rescheduled',
  'pre-PAID reschedule recomputes charge_scheduled_at'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.cns_reschedule.pre_paid')::uuid
  ),
  'SCHEDULED',
  'pre-PAID schedule stays SCHEDULED after reschedule'
);

select is(
  public.cns_confirm_service_reschedule(
    current_setting('test.cns_reschedule.post_paid')::uuid,
    current_setting('test.cns_reschedule.new_slot')::jsonb
  )->'payment'->>'outcome',
  'paid_no_charge_update',
  'post-PAID reschedule skips charge date update'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.cns_reschedule.post_paid')::uuid
  ),
  'PAID',
  'post-PAID schedule remains PAID after reschedule'
);

select finish();

rollback;
