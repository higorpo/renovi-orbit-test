-- pgTAP: payment Task 87 — cns_confirm_service_cancellation payment integration.

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

create or replace function pg_temp.cns_seed_cancel_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_service_status public.contracted_service_status default 'PENDING_PAYMENT'::public.contracted_service_status
)
returns table (
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
    format('cancel pgTAP %s', p_contracted_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform pg_temp.cns_set_auth(p_provider_id);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date + 10, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, p_provider_id, v_service_request_id, v_pricing.original_amount,
    'cancel pgTAP proposal', 1, 'days', jsonb_build_array(v_slot),
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
    p_provider_id, 'days', 1, current_date + 10, 'morning', v_slot,
    p_service_status
  );

  client_id := v_client_id;
  return next;
end;
$$;

select throws_ok(
  $$ select public.cns_confirm_service_cancellation(gen_random_uuid()) $$,
  '42501',
  'Authentication required for cns_confirm_service_cancellation',
  'rejects unauthenticated callers'
);

do $seed$
declare
  v_pre_paid_id uuid := gen_random_uuid();
  v_post_paid_id uuid := gen_random_uuid();
  v_in_analysis_id uuid := gen_random_uuid();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_client_id uuid;
begin
  select client_id into v_client_id
  from pg_temp.cns_seed_cancel_fixture(v_pre_paid_id, v_provider_id);

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
  from pg_temp.cns_seed_cancel_fixture(
    v_post_paid_id,
    v_provider_id,
    'CONFIRMED'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, paid_at,
    gateway_transaction_id
  )
  values (
    v_post_paid_id, v_client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00,
    now() - interval '1 day',
    'PAID'::public.payment_schedule_state,
    v_post_paid_id::text,
    now() - interval '1 day',
    'txn-post-paid-pgtap'
  );

  select client_id into v_client_id
  from pg_temp.cns_seed_cancel_fixture(v_in_analysis_id, v_provider_id);

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key
  )
  values (
    v_in_analysis_id, v_client_id, v_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00,
    now() + interval '2 days',
    'IN_ANALYSIS'::public.payment_schedule_state,
    v_in_analysis_id::text
  );

  perform set_config('test.cns_cancel.pre_paid', v_pre_paid_id::text, true);
  perform set_config('test.cns_cancel.post_paid', v_post_paid_id::text, true);
  perform set_config('test.cns_cancel.in_analysis', v_in_analysis_id::text, true);
  perform set_config('test.cns_cancel.client_id', v_client_id::text, true);
end;
$seed$;

select pg_temp.cns_set_auth(current_setting('test.cns_cancel.client_id')::uuid);

select throws_ok(
  format(
    $$ select public.cns_confirm_service_cancellation(%L::uuid) $$,
    current_setting('test.cns_cancel.in_analysis')::uuid
  ),
  'P0001',
  'PAYMENT_IN_ANALYSIS',
  'blocks cancellation while schedule is IN_ANALYSIS'
);

select is(
  public.cns_confirm_service_cancellation(
    current_setting('test.cns_cancel.pre_paid')::uuid
  )->>'outcome',
  'pre_charge_cancelled',
  'pre-PAID cancellation invokes payment_pre_charge_cancel'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.cns_cancel.pre_paid')::uuid
  ),
  'CANCELLED',
  'pre-PAID schedule transitions to CANCELLED'
);

select is(
  public.cns_confirm_service_cancellation(
    current_setting('test.cns_cancel.post_paid')::uuid
  )->>'outcome',
  'requires_process_refund_ef',
  'post-PAID cancellation routes to process-refund EF'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.cns_cancel.post_paid')::uuid
  ),
  'PAID',
  'post-PAID schedule stays PAID until process-refund EF runs'
);

select finish();

rollback;
