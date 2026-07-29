-- pgTAP: Option A — prepare leaves PAID intact; commit cancels + SUBMITTED.

begin;

select plan(7);

create or replace function pg_temp.paid_refund_set_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
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
    format('paid refund pgTAP %s', p_contracted_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform set_config('request.jwt.claim.sub', p_provider_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into v_pricing
  from public.calculate_provider_service_pricing(600.00::numeric);

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
    'paid refund pgTAP proposal', 1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  values (
    p_contracted_service_id, v_service_request_id, v_proposal_id, v_client_id,
    p_provider_id, 'days', 1, current_date + 10, current_date + 10, 'morning', v_slot,
    p_service_status
  );

  client_id := v_client_id;
  return next;
end;
$$;

do $seed$
declare
  v_service_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
begin
  select client_id into v_client_id
  from pg_temp.cns_seed_cancel_fixture(
    v_service_id,
    v_provider_id,
    'CONFIRMED'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, paid_at, paid_amount,
    gateway_transaction_id,
    gateway_reference_code)
  values (
    v_service_id, v_client_id, v_provider_id, 'netcred',
    1, 600.00, 15.00, 510.00,
    now() - interval '1 day',
    'PAID'::public.payment_schedule_state,
    v_service_id::text,
    now() - interval '1 day',
    633.70,
    'txn-paid-refund-transition-pgtap',
    v_service_id);

  perform set_config('test.paid_refund.service_id', v_service_id::text, true);
  perform set_config('test.paid_refund.client_id', v_client_id::text, true);
end;
$seed$;

select lives_ok(
  format(
    $$ select pg_temp.paid_refund_set_service_role();
       select public.payment_prepare_refund_request(%L::uuid, %L::uuid, 'CLIENT_INITIATED', 'client'); $$,
    current_setting('test.paid_refund.service_id'),
    current_setting('test.paid_refund.client_id')
  ),
  'payment_prepare_refund_request succeeds for PAID schedule'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.paid_refund.service_id')::uuid
  ),
  'PAID',
  'prepare leaves schedule in PAID (no cancel)'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    where cs.id = current_setting('test.paid_refund.service_id')::uuid
  ),
  'CONFIRMED',
  'prepare does not cancel contracted service'
);

select lives_ok(
  format(
    $$ select pg_temp.paid_refund_set_service_role();
       select public.payment_commit_refund_after_gateway(
         %L::uuid, %L::uuid, 'CLIENT_INITIATED', 'client', 633.70
       ); $$,
    current_setting('test.paid_refund.service_id'),
    current_setting('test.paid_refund.client_id')
  ),
  'payment_commit_refund_after_gateway succeeds after gateway ACK'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.paid_refund.service_id')::uuid
  ),
  'REFUND_REQUESTED',
  'commit transitions PAID → REFUND_REQUESTED'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    where cs.id = current_setting('test.paid_refund.service_id')::uuid
  ),
  'CANCELLED',
  'commit cancels contracted service'
);

select is(
  (
    select ps.refund_submit_status::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.paid_refund.service_id')::uuid
  ),
  'SUBMITTED',
  'commit sets refund_submit_status SUBMITTED'
);

select finish();

rollback;
