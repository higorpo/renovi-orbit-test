-- pgTAP: payment Task 98 — failure injection: webhook duplicate + out-of-order delivery (Req 17.2–17.3, 18.2).

begin;

select plan(14);

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

create or replace function pg_temp.payment_seed_webhook_schedule_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_schedule_state public.payment_schedule_state default 'IN_ANALYSIS'::public.payment_schedule_state
)
returns uuid
language plpgsql
as $$
declare
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_pricing record;
  v_slot jsonb;
  v_card_token_id uuid := gen_random_uuid();
  v_schedule_id uuid := gen_random_uuid();
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
    format('webhook failure injection %s', p_contracted_service_id),
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

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date + 5, 'YYYY-MM-DD'),
    'end_date', to_char(current_date + 5, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, p_provider_id, v_service_request_id, v_pricing.original_amount,
    'webhook failure injection proposal', 1, 'days', jsonb_build_array(v_slot),
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
    p_provider_id, 'days', 1, current_date + 5, current_date + 5, 'morning', v_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  insert into public.client_card_tokens (
    id, client_id, gateway_slug, gateway_payment_profile_id, card_number_masked,
    card_brand, gateway_card_token, expiry_month, expiry_year, cardholder_name,
    billing_address, state
  )
  values (
    v_card_token_id, v_client_id, 'netcred', format('profile-%s', p_contracted_service_id),
    '497010XXXXXX0048', 'visa', format('token-%s', p_contracted_service_id), 12, 2030,
    'Webhook Failure Injection', '{}'::jsonb, 'ACTIVE'::public.payment_client_card_token_state
  );

  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    client_card_token_id, installment_number, base_amount, commission_rate_pct,
    provider_payout, charge_scheduled_at, state, idempotency_key
  )
  values (
    v_schedule_id, p_contracted_service_id, v_client_id, p_provider_id, 'netcred',
    v_card_token_id, 1, 100.00, 10.00, 90.00, now() - interval '1 hour', p_schedule_state,
    p_contracted_service_id::text
  );

  return v_schedule_id;
end;
$$;

do $seed$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_contracted_service_id uuid := gen_random_uuid();
  v_schedule_id uuid;
begin
  insert into public.provider_gateway_accounts (
    provider_id, gateway_slug, document, onboarding_status, onboarding_activated_at
  )
  values (
    v_provider_id,
    'netcred'::public.payment_gateway_slug,
    '12345678901',
    'ACTIVE'::public.payment_provider_onboarding_status,
    now()
  )
  on conflict (provider_id, gateway_slug) do update
  set onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status;

  v_schedule_id := pg_temp.payment_seed_webhook_schedule_fixture(
    v_contracted_service_id,
    v_provider_id,
    'IN_ANALYSIS'::public.payment_schedule_state
  );

  perform set_config('test.webhook.contracted_service_id', v_contracted_service_id::text, true);
  perform set_config('test.webhook.schedule_id', v_schedule_id::text, true);
end;
$seed$;

select pg_temp.payment_set_service_role();

select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-failure-inject-dup-pre',
    jsonb_build_object(
      'id', 'evt-failure-inject-dup-pre',
      'transaction', jsonb_build_object(
        'referenceCode', current_setting('test.webhook.contracted_service_id'),
        'transactionState', 'PAID'
      ),
      'paidAmount', '100.00'
    ),
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb
  )->>'status',
  'inserted',
  'first webhook ingest succeeds before duplicate delivery'
);

select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-failure-inject-dup-pre',
    jsonb_build_object(
      'id', 'evt-failure-inject-dup-pre',
      'transaction', jsonb_build_object(
        'referenceCode', current_setting('test.webhook.contracted_service_id'),
        'transactionState', 'PAID'
      ),
      'paidAmount', '100.00',
      'duplicateDelivery', true
    ),
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb
  )->>'status',
  'duplicate',
  'duplicate gateway_event_id dedup returns duplicate status before processing'
);

select is(
  public.payment_process_webhook_event(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-failure-inject-dup-pre'
    )
  )->>'outcome',
  'duplicate_skipped',
  'processing duplicate webhook skips handler side effects'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.id = current_setting('test.webhook.schedule_id')::uuid
  ),
  'IN_ANALYSIS',
  'duplicate delivery before process leaves schedule unchanged'
);

select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-failure-inject-capture-paid',
    jsonb_build_object(
      'id', 'evt-failure-inject-capture-paid',
      'transaction', jsonb_build_object(
        'referenceCode', current_setting('test.webhook.contracted_service_id'),
        'transactionState', 'PAID'
      ),
      'paidAmount', '100.00'
    ),
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb
  )->>'status',
  'inserted',
  'distinct capture webhook ingest succeeds after duplicate skip'
);

select is(
  public.payment_process_webhook_event(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-failure-inject-capture-paid'
    )
  )->'handler'->>'outcome',
  'paid',
  'capture webhook transitions IN_ANALYSIS schedule to PAID'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.id = current_setting('test.webhook.schedule_id')::uuid
  ),
  'PAID',
  'schedule is PAID after successful capture webhook'
);

select is(
  (
    select count(*)::int
    from public.payment_webhook_events
    where gateway_event_id = 'evt-failure-inject-dup-pre'
  ),
  1,
  'UNIQUE dedup keeps a single row for duplicate gateway_event_id'
);

select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-failure-inject-capture-paid',
    jsonb_build_object(
      'id', 'evt-failure-inject-capture-paid',
      'transaction', jsonb_build_object(
        'referenceCode', current_setting('test.webhook.contracted_service_id'),
        'transactionState', 'PAID'
      ),
      'paidAmount', '100.00',
      'duplicateDelivery', true
    ),
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb
  )->>'status',
  'duplicate',
  'duplicate delivery after PROCESSED keeps PROCESSED state at ingest'
);

select is(
  public.payment_process_webhook_event(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-failure-inject-capture-paid'
    )
  )->>'outcome',
  'already_processed',
  're-processing PROCESSED webhook is idempotent'
);

select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_UPDATE',
    'evt-failure-inject-rejected-late',
    jsonb_build_object(
      'id', 'evt-failure-inject-rejected-late',
      'transaction', jsonb_build_object(
        'referenceCode', current_setting('test.webhook.contracted_service_id'),
        'transactionState', 'REJECTED'
      ),
      'failureCode', 'CARD_DECLINED'
    ),
    '{"X-NETCRED-Event":"TRANSACTION_UPDATE"}'::jsonb
  )->>'status',
  'inserted',
  'late rejected webhook ingest succeeds with new gateway_event_id'
);

select is(
  public.payment_process_webhook_event(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-failure-inject-rejected-late'
    )
  )->'handler'->>'outcome',
  'skipped',
  'out-of-order rejected webhook is skipped when schedule is already PAID'
);

select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-failure-inject-capture-late',
    jsonb_build_object(
      'id', 'evt-failure-inject-capture-late',
      'transaction', jsonb_build_object(
        'referenceCode', current_setting('test.webhook.contracted_service_id'),
        'transactionState', 'PAID'
      ),
      'paidAmount', '100.00'
    ),
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb
  )->>'status',
  'inserted',
  'late capture webhook ingest succeeds with distinct gateway_event_id'
);

select is(
  public.payment_process_webhook_event(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-failure-inject-capture-late'
    )
  )->'handler'->>'outcome',
  'already_paid',
  'late capture webhook is idempotent when schedule is already PAID'
);

select finish();

rollback;
