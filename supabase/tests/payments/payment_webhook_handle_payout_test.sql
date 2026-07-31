-- pgTAP: payment_webhook_handle_payout + bank_account_mask (PAYOUT_CREATE/SETTLE).

begin;

select plan(13);

create or replace function pg_temp.payment_set_service_role()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

select is(
  public.payment_webhook_payout_bank_account_mask(
    jsonb_build_object(
      'bank', jsonb_build_object('name', 'Banco X', 'compe', '001'),
      'number', '123456'
    )
  ),
  'Banco X ****3456',
  'bank_account_mask uses bank name + last 4 digits'
);

select is(
  public.payment_webhook_payout_bank_account_mask(
    jsonb_build_object(
      'bank', jsonb_build_object('compe', '341'),
      'number', '99'
    )
  ),
  '341 ****99',
  'bank_account_mask falls back to compe when name missing'
);

select is(
  public.payment_webhook_payout_bank_account_mask('[]'::jsonb),
  null,
  'bank_account_mask returns null for non-object'
);

select is(
  public.payment_webhook_handle_payout(gen_random_uuid(), null)->>'reason',
  'invalid_payload',
  'null payload is noop invalid_payload'
);

select is(
  public.payment_webhook_handle_payout(
    gen_random_uuid(),
    jsonb_build_object('movements', jsonb_build_array())
  )->>'reason',
  'missing_payout_id',
  'missing payout id is noop'
);

select is(
  public.payment_webhook_handle_payout(
    gen_random_uuid(),
    jsonb_build_object('id', 'payout-no-mov', 'movements', '[]'::jsonb)
  )->>'reason',
  'empty_movements',
  'empty movements array is noop'
);

select pg_temp.payment_set_service_role();

do $seed$
declare
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_sr_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_cs_id uuid := gen_random_uuid();
  v_schedule_id uuid := gen_random_uuid();
  v_tx_id text := 'payout-handler-tx-1001';
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', (current_date + 4)::text,
    'shift', 'morning'
  );
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  if v_client_id is null then
    raise exception 'payout handler fixture: seed service_request missing';
  end if;

  perform set_config('request.jwt.claim.sub', v_provider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_provider_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into v_pricing
  from public.calculate_provider_service_pricing(150.00::numeric);

  perform pg_temp.payment_set_service_role();
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role', 'sub', v_provider_id::text)::text,
    true
  );

  insert into public.provider_gateway_accounts (
    provider_id,
    gateway_slug,
    document,
    onboarding_status,
    onboarding_activated_at,
    netcred_company_id,
    netcred_bank_account_id
  )
  values (
    v_provider_id,
    'netcred'::public.payment_gateway_slug,
    '12345678901',
    'ACTIVE'::public.payment_provider_onboarding_status,
    now(),
    '1048',
    'bank-account-payout-handler'
  )
  on conflict (provider_id, gateway_slug) do update
  set
    onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status,
    netcred_company_id = '1048',
    netcred_bank_account_id = coalesce(
      nullif(btrim(provider_gateway_accounts.netcred_bank_account_id), ''),
      excluded.netcred_bank_account_id
    );

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description,
    form_data, form_version, status, urgency
  )
  select
    v_sr_id,
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'Payout handler fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id,
    v_provider_id,
    v_sr_id,
    v_pricing.original_amount,
    'Payout handler proposal',
    1,
    'days',
    jsonb_build_array(v_slot),
    '{}'::text[],
    v_pricing.tax_rate,
    v_pricing.tax_amount,
    v_pricing.final_amount,
    v_pricing.pricing_signature,
    'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  values (
    v_cs_id,
    v_sr_id,
    v_proposal_id,
    v_client_id,
    v_provider_id,
    'days',
    1,
    current_date + 4,
    current_date + 4,
    'morning',
    v_slot,
    'CONFIRMED'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    id, contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, paid_amount, paid_at, idempotency_key,
    gateway_reference_code, gateway_transaction_id
  )
  values (
    v_schedule_id,
    v_cs_id,
    v_client_id,
    v_provider_id,
    'netcred',
    1,
    150.00,
    10.00,
    135.00,
    now() - interval '2 days',
    'PAID'::public.payment_schedule_state,
    165.00,
    now() - interval '1 day',
    v_cs_id::text,
    v_cs_id,
    v_tx_id
  );

  perform set_config('test.payout.tx_id', v_tx_id, true);
  perform set_config('test.payout.schedule_id', v_schedule_id::text, true);
  perform set_config('test.payout.provider_id', v_provider_id::text, true);
end;
$seed$;

select is(
  public.payment_webhook_handle_payout(
    gen_random_uuid(),
    jsonb_build_object(
      'id', 'payout-handler-1',
      'payout_status', 'PENDING',
      'brand', 'MCC',
      'bank_account', jsonb_build_object(
        'bank', jsonb_build_object('name', 'Nubank'),
        'number', '987654'
      ),
      'movements', jsonb_build_array(
        jsonb_build_object(
          'id', 'mov-payout-provider-1',
          'transaction_id', current_setting('test.payout.tx_id'),
          'holder_company_id', '1048',
          'company_id', '1048',
          'movement_status', 'PENDING',
          'movement_type', 'CARD_PAYMENT',
          'movement_source', 'TRANSACTION',
          'record_type', 'CREDIT',
          'amount', '150.00',
          'net_amount', '135.00',
          'settling_at', (current_date + 20)::text
        ),
        jsonb_build_object(
          'id', 'mov-payout-platform-1',
          'transaction_id', current_setting('test.payout.tx_id'),
          'holder_company_id', '1014',
          'company_id', '1014',
          'movement_status', 'PENDING',
          'record_type', 'CREDIT',
          'amount', '15.00',
          'net_amount', '15.00',
          'settling_at', (current_date + 20)::text
        )
      )
    )
  )->>'outcome',
  'upserted',
  'PAYOUT upserts provider leg and filters platform split'
);

select is(
  (
    select count(*)::int
    from public.payment_settlement_movements
    where gateway_movement_id = 'mov-payout-provider-1'
      and bank_account_mask = 'Nubank ****7654'
      and payment_schedule_id = current_setting('test.payout.schedule_id')::uuid
  ),
  1,
  'handler persists provider movement with masked bank account'
);

select is(
  (
    select count(*)::int
    from public.payment_settlement_movements
    where gateway_movement_id = 'mov-payout-platform-1'
  ),
  0,
  'handler does not persist platform holder_company leg'
);

select is(
  public.payment_webhook_handle_payout(
    gen_random_uuid(),
    jsonb_build_object(
      'id', 'payout-missing-tx',
      'payout_status', 'PENDING',
      'movements', jsonb_build_array(
        jsonb_build_object(
          'id', 'mov-missing-tx-1',
          'transaction_id', 'tx-does-not-exist-999',
          'holder_company_id', '1048',
          'movement_status', 'PENDING',
          'record_type', 'CREDIT',
          'amount', '10.00',
          'net_amount', '9.00'
        )
      )
    )
  )->>'outcome',
  'not_found',
  'missing schedule for transaction_id returns not_found (retryable)'
);

select is(
  public.payment_webhook_handle_payout(
    gen_random_uuid(),
    jsonb_build_object(
      'id', 'payout-platform-only',
      'payout_status', 'PENDING',
      'movements', jsonb_build_array(
        jsonb_build_object(
          'id', 'mov-platform-only-1',
          'transaction_id', current_setting('test.payout.tx_id'),
          'holder_company_id', '1014',
          'movement_status', 'PENDING',
          'record_type', 'CREDIT',
          'amount', '10.00',
          'net_amount', '10.00'
        )
      )
    )
  )->>'reason',
  'all_filtered',
  'platform-only batch is terminal noop all_filtered'
);

select is(
  public.payment_webhook_handle_payout(
    gen_random_uuid(),
    jsonb_build_object(
      'id', 'payout-invalid-mov',
      'movements', jsonb_build_array(
        jsonb_build_object('id', 'incomplete'),
        'not-an-object'
      )
    )
  )->>'reason',
  'no_valid_movements',
  'invalid movement shapes yield no_valid_movements'
);

select public.payment_ingest_webhook_event(
  'netcred'::public.payment_gateway_slug,
  'PAYOUT_SETTLE',
  'evt-payout-settle-not-found',
  jsonb_build_object(
    'id', 'payout-settle-nf',
    'payout_status', 'PAID_OUT',
    'movements', jsonb_build_array(
      jsonb_build_object(
        'id', 'mov-settle-nf-1',
        'transaction_id', 'tx-settle-missing',
        'holder_company_id', '1048',
        'movement_status', 'PAID_OUT',
        'record_type', 'CREDIT',
        'amount', '1.00',
        'net_amount', '1.00'
      )
    )
  ),
  '{"X-NETCRED-Event":"PAYOUT_SETTLE"}'::jsonb,
  true
);

select is(
  public.payment_process_webhook_event(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-payout-settle-not-found'
    )
  )->>'outcome',
  'retry_scheduled',
  'PAYOUT_SETTLE not_found schedules webhook retry via process_webhook_event'
);

select * from finish();

rollback;
