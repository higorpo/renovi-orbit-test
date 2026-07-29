-- pgTAP: post-PAID reschedule keeps charge frozen, but ToS refund tiers follow the new slot.

begin;

select plan(4);

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
  v_service_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_pricing record;
  v_slot_near jsonb;
  v_slot_far jsonb;
  v_near_date date := (now() + interval '6 hours')::date;
  v_far_date date := (now() + interval '72 hours')::date;
  v_anchor timestamptz := now() + interval '6 hours';
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  v_slot_near := jsonb_build_object(
    'start_date', to_char(v_near_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_slot_far := jsonb_build_object(
    'start_date', to_char(v_far_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select
    v_service_request_id, sr.client_id, sr.service_id, sr.address_id,
    'refund tier follows reschedule pgTAP',
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
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
  from public.calculate_provider_service_pricing(1000.00::numeric);

  perform pg_temp.payment_set_service_role();

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, v_provider_id, v_service_request_id, v_pricing.original_amount,
    'reschedule refund tier proposal', 1, 'days', jsonb_build_array(v_slot_near),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  values (
    v_service_id, v_service_request_id, v_proposal_id, v_client_id,
    v_provider_id, 'days', 1, v_near_date, v_near_date, 'morning', v_slot_near,
    'CONFIRMED'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, gateway_reference_code,
    paid_at, paid_amount, gateway_transaction_id, refund_anchor_execution_at
  )
  values (
    v_service_id, v_client_id, v_provider_id, 'netcred',
    1, 1000.00, 15.00, 850.00,
    now() - interval '2 days',
    'PAID'::public.payment_schedule_state,
    v_service_id::text,
    v_service_id,
    now() - interval '1 day',
    1024.29,
    'txn-refund-tier-reschedule',
    v_anchor
  );

  -- Post-PAID reschedule moves execution far out → FULL_REFUND on cancel.
  update public.contracted_services cs
  set
    scheduled_start_date = v_far_date,
    scheduled_end_date = v_far_date,
    scheduled_shift = 'morning',
    agreed_slot = v_slot_far
  where cs.id = v_service_id;

  perform set_config('test.refund_tier.service_id', v_service_id::text, true);
  perform set_config('test.refund_tier.client_id', v_client_id::text, true);
  perform set_config('test.refund_tier.anchor_at', v_anchor::text, true);
end;
$seed$;

select is(
  (
    select ps.refund_anchor_execution_at::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.refund_tier.service_id')::uuid
  ),
  current_setting('test.refund_tier.anchor_at'),
  'refund_anchor_execution_at remains frozen at first PAID (audit snapshot)'
);

select is(
  public.payment_reschedule_charge_date(
    current_setting('test.refund_tier.service_id')::uuid
  )->>'outcome',
  'paid_no_charge_update',
  'post-PAID reschedule does not mutate charge_scheduled_at'
);

select is(
  (
    select public.payment_prepare_refund_request(
      current_setting('test.refund_tier.service_id')::uuid,
      current_setting('test.refund_tier.client_id')::uuid,
      'CLIENT_INITIATED',
      'client'
    )->>'penalty_tier'
  ),
  'FULL_REFUND',
  'cancel after +72h reschedule uses current slot → FULL_REFUND'
);

select is(
  (
    select public.payment_prepare_refund_request(
      current_setting('test.refund_tier.service_id')::uuid,
      current_setting('test.refund_tier.client_id')::uuid,
      'CLIENT_INITIATED',
      'client'
    )->>'penalty_tier'
  ),
  'FULL_REFUND',
  'idempotent prepare keeps FULL_REFUND after post-PAID reschedule'
);

select finish();

rollback;
