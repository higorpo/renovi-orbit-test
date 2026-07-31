-- pgTAP: payment_settlement_movements table SELECT denied; list RPC still works for owner.

begin;

select plan(6);

create or replace function pg_temp.settlement_deny_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.settlement_deny_set_service_role()
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

select ok(
  not has_table_privilege('authenticated', 'public.payment_settlement_movements', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_settlement_movements', 'id', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_settlement_movements', 'net_amount', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_settlement_movements', 'raw_snapshot', 'SELECT')
    and not has_table_privilege('authenticated', 'public.payment_settlement_movements', 'INSERT')
    and not has_table_privilege('authenticated', 'public.payment_settlement_movements', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.payment_settlement_movements', 'DELETE'),
  'authenticated has no SELECT (table or columns) and no DML on payment_settlement_movements'
);

select ok(
  has_table_privilege('service_role', 'public.payment_settlement_movements', 'SELECT')
    and has_table_privilege('service_role', 'public.payment_settlement_movements', 'INSERT'),
  'service_role retains SELECT/INSERT on payment_settlement_movements'
);

-- Seed owner movement + list via RPC
do $seed$
declare
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_sr_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_cs_id uuid := gen_random_uuid();
  v_schedule_id uuid := gen_random_uuid();
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', (current_date + 3)::text,
    'shift', 'morning'
  );
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  if v_client_id is null then
    raise exception 'settlement deny fixture: seed service_request missing';
  end if;

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description,
    form_data, form_version, status, urgency
  )
  select
    v_sr_id,
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'settlement table deny',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
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
  from public.calculate_provider_service_pricing(100.00::numeric);

  reset role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);

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
    'settlement deny proposal',
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
    current_date + 3,
    current_date + 3,
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
    100.00,
    10.00,
    90.00,
    now() - interval '2 days',
    'PAID'::public.payment_schedule_state,
    110.00,
    now() - interval '1 day',
    v_cs_id::text,
    v_cs_id,
    'settlement-deny-tx-1'
  );

  perform public.payment_upsert_settlement_movements(
    jsonb_build_array(
      jsonb_build_object(
        'gateway_slug', 'netcred',
        'gateway_payout_id', 'payout-deny-1',
        'gateway_movement_id', 'mov-deny-1',
        'gateway_transaction_id', 'settlement-deny-tx-1',
        'holder_company_id', '1048',
        'payout_status', 'PAID_OUT',
        'movement_status', 'PAID_OUT',
        'movement_type', 'CARD_PAYMENT',
        'movement_source', 'TRANSACTION',
        'record_type', 'CREDIT',
        'installment', 1,
        'gross_amount', '100.00',
        'net_amount', '90.00',
        'settling_at', (current_date + 30)::text,
        'settled_at', now()::text,
        'bank_account_mask', 'Banco X ****9999',
        'sync_source', 'webhook'
      )
    )
  );

  perform set_config('test.settlement_deny.provider_id', v_provider_id::text, true);
  perform set_config('test.settlement_deny.schedule_id', v_schedule_id::text, true);
end;
$seed$;

select pg_temp.settlement_deny_set_auth(current_setting('test.settlement_deny.provider_id')::uuid);

select throws_ok(
  $$select id from public.payment_settlement_movements limit 1$$,
  '42501',
  null,
  'authenticated cannot SELECT payment_settlement_movements table directly'
);

select is(
  (
    public.list_provider_settlement_movements(1, 20)->'total_count'
  )::int >= 1,
  true,
  'list_provider_settlement_movements still returns data for owning provider'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.list_provider_settlement_movements(1, 50)->'items'
    ) item
    where item->>'gateway_movement_id' = 'mov-deny-1'
  ),
  'owner list RPC includes seeded gateway_movement_id'
);

select pg_temp.settlement_deny_set_service_role();

select ok(
  (
    select count(*)::int
    from public.payment_settlement_movements
    where gateway_movement_id = 'mov-deny-1'
  ) = 1,
  'service_role can still SELECT payment_settlement_movements'
);

select * from finish();

rollback;
