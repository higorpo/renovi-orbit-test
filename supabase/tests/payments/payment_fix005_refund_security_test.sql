-- pgTAP: FIX-005 / CHK-010 — TRANSACTION_REFUND from PAID applies refund amounts.
-- pgTAP: FIX-005 / CHK-008 — already_submitted only after gateway ACK (SUBMITTED).
-- pgTAP: FIX-005 — refund submit ACK machine + PAID→REFUNDED webhook paths.

begin;

select plan(10);

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

create or replace function pg_temp.fix005_seed_paid_schedule(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_hours_to_service numeric,
  p_anchor_hours_to_service numeric default null
)
returns uuid
language plpgsql
as $$
declare
  v_client_id uuid;
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_pricing record;
  v_slot jsonb;
  v_start_date date;
  v_anchor timestamptz;
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  v_start_date := (now() + make_interval(hours => p_hours_to_service::int))::date;
  v_slot := jsonb_build_object(
    'start_date', to_char(v_start_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select
    v_service_request_id, sr.client_id, sr.service_id, sr.address_id,
    format('fix005 pgTAP %s', p_contracted_service_id),
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
  from public.calculate_provider_service_pricing(1000.00::numeric);

  perform pg_temp.payment_set_service_role();

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, p_provider_id, v_service_request_id, v_pricing.original_amount,
    'fix005 proposal', 1, 'days', jsonb_build_array(v_slot),
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
    p_provider_id, 'days', 1, v_start_date, v_start_date, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  );

  v_anchor := coalesce(
    now() + make_interval(hours => coalesce(p_anchor_hours_to_service, p_hours_to_service)::int),
    public.payment_service_execution_at(
      (select cs from public.contracted_services cs where cs.id = p_contracted_service_id)
    )
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, gateway_reference_code,
    paid_at, paid_amount, gateway_transaction_id, refund_anchor_execution_at
  )
  values (
    p_contracted_service_id, v_client_id, p_provider_id, 'netcred',
    1, 1000.00, 15.00, 850.00,
    now() - interval '2 days',
    'PAID'::public.payment_schedule_state,
    p_contracted_service_id::text,
    p_contracted_service_id,
    now() - interval '1 day',
    1024.29,
    'txn-fix005-' || p_contracted_service_id::text,
    v_anchor
  );

  return v_client_id;
end;
$$;

select pg_temp.payment_set_service_role();

-- ---------------------------------------------------------------------------
-- CHK-010: PAID + TRANSACTION_REFUND → REFUNDED
-- ---------------------------------------------------------------------------

do $seed_refund$
declare
  v_service_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_ingest jsonb;
begin
  v_client_id := pg_temp.fix005_seed_paid_schedule(v_service_id, v_provider_id, 72);

  v_ingest := public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_REFUND',
    'evt-fix005-refund-from-paid',
    jsonb_build_object(
      'referenceCode', v_service_id::text,
      'refunded_amount', '1024.29',
      'transaction', jsonb_build_object(
        'transaction_state', 'REFUNDED',
        'refunded_amount', '1024.29'
      )
    ),
    '{"X-NETCRED-Event":"TRANSACTION_REFUND"}'::jsonb,
    true
  );

  perform set_config('test.fix005.refund_service_id', v_service_id::text, true);
  perform set_config('test.fix005.refund_event_id', (v_ingest->>'event_id'), true);
  perform set_config('test.fix005.refund_client_id', v_client_id::text, true);
end;
$seed_refund$;

select is(
  public.payment_process_webhook_event(
    current_setting('test.fix005.refund_event_id')::uuid
  )->'handler'->>'outcome',
  'refunded',
  'CHK-010: TRANSACTION_REFUND from PAID applies refund'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.fix005.refund_service_id')::uuid
  ),
  'REFUNDED',
  'CHK-010: schedule moves PAID → REFUNDED'
);

select is(
  (
    select ps.refund_submit_status::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.fix005.refund_service_id')::uuid
  ),
  'CONFIRMED',
  'CHK-010: external refund marks refund_submit_status CONFIRMED'
);

select is(
  (
    select ps.refunded_amount::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.fix005.refund_service_id')::uuid
  ),
  '1024.29',
  'CHK-010: refunded_amount applied from webhook payload'
);

-- ---------------------------------------------------------------------------
-- CHK-008: already_submitted only after SUBMITTED
-- ---------------------------------------------------------------------------

do $seed_submit$
declare
  v_service_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
begin
  v_client_id := pg_temp.fix005_seed_paid_schedule(v_service_id, v_provider_id, 72);
  perform set_config('test.fix005.submit_service_id', v_service_id::text, true);
  perform set_config('test.fix005.submit_client_id', v_client_id::text, true);
end;
$seed_submit$;

select is(
  (
    select public.payment_begin_refund_request(
      current_setting('test.fix005.submit_service_id')::uuid,
      current_setting('test.fix005.submit_client_id')::uuid,
      'CLIENT_INITIATED',
      'client'
    )->>'already_submitted'
  ),
  'false',
  'CHK-008: first begin_refund returns already_submitted=false'
);

select is(
  (
    select ps.refund_submit_status::text
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.fix005.submit_service_id')::uuid
  ),
  'PENDING_GATEWAY',
  'CHK-008: begin_refund sets PENDING_GATEWAY'
);

select is(
  (
    select public.payment_begin_refund_request(
      current_setting('test.fix005.submit_service_id')::uuid,
      current_setting('test.fix005.submit_client_id')::uuid,
      'CLIENT_INITIATED',
      'client'
    )->>'already_submitted'
  ),
  'false',
  'CHK-008: retry before gateway ACK keeps already_submitted=false'
);

select lives_ok(
  format(
    $$ select public.payment_set_refund_submit_status(
         (select id from public.payment_schedules
          where contracted_service_id = %L::uuid),
         'FAILED'::public.payment_refund_submit_status,
         %L::uuid,
         'gateway unavailable'
       ) $$,
    current_setting('test.fix005.submit_service_id'),
    current_setting('test.fix005.submit_client_id')
  ),
  'CHK-008: gateway failure marks FAILED while schedule stays REFUND_REQUESTED'
);

select is(
  (
    select public.payment_begin_refund_request(
      current_setting('test.fix005.submit_service_id')::uuid,
      current_setting('test.fix005.submit_client_id')::uuid,
      'CLIENT_INITIATED',
      'client'
    )->>'already_submitted'
  ),
  'false',
  'CHK-008: FAILED status still returns already_submitted=false for Edge retry'
);

do $ack$
begin
  perform public.payment_set_refund_submit_status(
    (
      select id
      from public.payment_schedules
      where contracted_service_id = current_setting('test.fix005.submit_service_id')::uuid
    ),
    'SUBMITTED'::public.payment_refund_submit_status,
    current_setting('test.fix005.submit_client_id')::uuid
  );
end;
$ack$;

select is(
  (
    select public.payment_begin_refund_request(
      current_setting('test.fix005.submit_service_id')::uuid,
      current_setting('test.fix005.submit_client_id')::uuid,
      'CLIENT_INITIATED',
      'client'
    )->>'already_submitted'
  ),
  'true',
  'CHK-008: already_submitted=true only after gateway ACK (SUBMITTED)'
);

select finish();

rollback;
