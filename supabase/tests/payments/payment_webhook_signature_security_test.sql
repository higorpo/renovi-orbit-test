-- pgTAP: FIX-001 — unsigned webhook cannot forge PAID; poison does not block signed; amount bind.

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

create or replace function pg_temp.payment_seed_schedule(
  p_contracted_service_id uuid,
  p_provider_id uuid
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
    format('fix001 webhook %s', p_contracted_service_id),
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
    'fix001 proposal', 1, 'days', jsonb_build_array(v_slot),
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
    id, client_id, gateway_slug, gateway_payment_profile_id, netcred_company_id, card_number_masked,
    card_brand, gateway_card_token, expiry_month, expiry_year, cardholder_name,
    billing_address, state
  )
  values (
    v_card_token_id, v_client_id, 'netcred', format('profile-%s', p_contracted_service_id),
    '1014',
    '497010XXXXXX0048', 'visa', format('token-%s', p_contracted_service_id), 12, 2030,
    'FIX001', '{}'::jsonb, 'ACTIVE'::public.payment_client_card_token_state
  );

  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    client_card_token_id, installment_number, base_amount, commission_rate_pct,
    provider_payout, charge_scheduled_at, state, idempotency_key,
    gateway_reference_code
  )
  values (
    v_schedule_id, p_contracted_service_id, v_client_id, p_provider_id, 'netcred',
    v_card_token_id, 1, 100.00, 10.00, 90.00, now() - interval '1 hour',
    'IN_ANALYSIS'::public.payment_schedule_state,
    p_contracted_service_id::text,
    p_contracted_service_id
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
    provider_id, gateway_slug, document, onboarding_status, onboarding_activated_at,
    netcred_company_id
  )
  values (
    v_provider_id,
    'netcred'::public.payment_gateway_slug,
    '12345678901',
    'ACTIVE'::public.payment_provider_onboarding_status,
    now(),
    '1048'
  )
  on conflict (provider_id, gateway_slug) do update
  set onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status;

  v_schedule_id := pg_temp.payment_seed_schedule(v_contracted_service_id, v_provider_id);

  perform set_config('test.fix001.contracted_service_id', v_contracted_service_id::text, true);
  perform set_config('test.fix001.schedule_id', v_schedule_id::text, true);
end;
$seed$;

select pg_temp.payment_set_service_role();

-- 1) Unsigned CAPTURE quarantines as DEAD_LETTER
select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-fix001-unsigned-capture',
    jsonb_build_object(
      'id', 'evt-fix001-unsigned-capture',
      'transaction', jsonb_build_object(
        'referenceCode', current_setting('test.fix001.contracted_service_id'),
        'transactionState', 'PAID'
      ),
      'paidAmount', '1.00'
    ),
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb,
    false
  )->>'status',
  'quarantined',
  'unsigned ingest returns quarantined status'
);

select is(
  (
    select state::text
    from public.payment_webhook_events
    where gateway_event_id = 'evt-fix001-unsigned-capture'
      and signature_validated = false
    order by created_at desc
    limit 1
  ),
  'DEAD_LETTER',
  'unsigned CAPTURE lands in DEAD_LETTER'
);

-- 2) Process refuses unsigned
select throws_ok(
  format(
    $$ select public.payment_process_webhook_event(%L::uuid) $$,
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-fix001-unsigned-capture'
        and signature_validated = false
      order by created_at desc
      limit 1
    )
  ),
  'P0001',
  'WEBHOOK_SIGNATURE_NOT_VALIDATED',
  'process refuses events without signature_validated'
);

-- 3) Schedule unchanged after unsigned CAPTURE attempt
select is(
  (
    select state::text
    from public.payment_schedules
    where id = current_setting('test.fix001.schedule_id')::uuid
  ),
  'IN_ANALYSIS',
  'unsigned CAPTURE never changes schedule state'
);

-- 4) Claim retry empty for INVALID_SIGNATURE quarantine
select is(
  public.payment_claim_webhook_retry_batch(),
  '[]'::jsonb,
  'claim retry batch empty for INVALID_SIGNATURE quarantine rows'
);

-- 5) Poison then signed same gateway_event_id still processes (CHK-004)
select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-fix001-poison-then-signed',
    jsonb_build_object(
      'id', 'evt-fix001-poison-then-signed',
      'paidAmount', '0.01'
    ),
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb,
    false
  )->>'status',
  'quarantined',
  'poison unsigned row quarantined'
);

select is(
  public.payment_ingest_webhook_event(
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_CAPTURE',
    'evt-fix001-poison-then-signed',
    jsonb_build_object(
      'id', 'evt-fix001-poison-then-signed',
      'transaction', jsonb_build_object(
        'referenceCode', current_setting('test.fix001.contracted_service_id'),
        'transactionState', 'PAID'
      ),
      'paidAmount', '9999.00'
    ),
    '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb,
    true
  )->>'status',
  'inserted',
  'signed event with same gateway_event_id still inserts after poison'
);

select is(
  public.payment_process_webhook_event(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-fix001-poison-then-signed'
        and signature_validated
    )
  )->'handler'->>'outcome',
  'paid',
  'signed event after poison processes CAPTURE to PAID'
);

select is(
  (
    select state::text
    from public.payment_schedules
    where id = current_setting('test.fix001.schedule_id')::uuid
  ),
  'PAID',
  'schedule becomes PAID from signed capture after poison'
);

-- 6) paid_amount bound to server expected (CHK-024), not forged gateway amount
select is(
  (
    select paid_amount = public.payment_calculate_charge_amount(
      client_card_token_id,
      base_amount,
      installment_number
    )
    from public.payment_schedules
    where id = current_setting('test.fix001.schedule_id')::uuid
  ),
  true,
  'paid_amount equals server expected charge amount, not gateway payload'
);

select isnt(
  (
    select paid_amount
    from public.payment_schedules
    where id = current_setting('test.fix001.schedule_id')::uuid
  ),
  9999.00::numeric,
  'forged gateway paidAmount 9999 is not stored as paid_amount'
);

select ok(
  exists (
    select 1
    from public.payment_audit_log a
    where a.schedule_id = current_setting('test.fix001.schedule_id')::uuid
      and a.event_type = 'CHARGE_PAID'
      and (a.metadata->>'gateway_paid_amount')::numeric = 9999.00
      and (a.metadata->>'amount_mismatch')::boolean = true
  ),
  'audit metadata stores gateway amount and amount_mismatch flag'
);

select finish();

rollback;
