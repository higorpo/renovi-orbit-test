-- pgTAP: payment_settlement_movements RLS/CLS + upsert/list isolation.

begin;

select plan(31);

create or replace function pg_temp.settlement_set_auth(p_user_id uuid)
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

create or replace function pg_temp.settlement_set_service_role()
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

create or replace function pg_temp.settlement_seed_user(
  p_user_id uuid,
  p_role text,
  p_name text
)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_user_id::text || '@settlement-test.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', p_name, 'role', p_role)::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role)
  values (p_user_id, p_name, case when p_role = 'admin' then 'client' else p_role end)
  on conflict (id) do update set full_name = excluded.full_name;

  if p_role = 'admin' then
    alter table public.profiles disable trigger profiles_prevent_admin_role_update;
    update public.profiles
    set full_name = p_name, role = 'admin'
    where id = p_user_id;
    alter table public.profiles enable trigger profiles_prevent_admin_role_update;
  end if;
end;
$$;

select ok(
  to_regclass('public.payment_settlement_movements') is not null,
  'payment_settlement_movements table exists'
);

select ok(
  to_regclass('public.provider_settlement_movements_v') is not null,
  'provider_settlement_movements_v exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_settlement_movements'
  ),
  'payment_settlement_movements has RLS enabled'
);

select ok(
  (
    select coalesce(c.reloptions @> array['security_invoker=true'], false)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'provider_settlement_movements_v'
  ),
  'provider_settlement_movements_v uses security_invoker'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment_settlement_movements', 'SELECT')
    and has_column_privilege('authenticated', 'public.payment_settlement_movements', 'net_amount', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_settlement_movements', 'raw_snapshot', 'SELECT')
    and not has_table_privilege('authenticated', 'public.payment_settlement_movements', 'INSERT')
    and not has_table_privilege('authenticated', 'public.payment_settlement_movements', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.payment_settlement_movements', 'DELETE'),
  'authenticated has CLS allowlist without raw_snapshot; no mutations'
);

select ok(
  not has_table_privilege('anon', 'public.payment_settlement_movements', 'SELECT')
    and not has_table_privilege('anon', 'public.provider_settlement_movements_v', 'SELECT'),
  'anon cannot select settlement table or view'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.payment_upsert_settlement_movements(jsonb)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'authenticated',
      'public.payment_upsert_settlement_movements(jsonb)',
      'EXECUTE'
    ),
  'upsert RPC is service_role only'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.list_provider_settlement_movements(integer, integer, text, text, date, date, timestamp with time zone, timestamp with time zone)',
    'EXECUTE'
  ),
  'list RPC is executable by authenticated'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_settlement_movements'
      and indexname = 'payment_settlement_movements_gateway_movement_unique'
  )
    or exists (
      select 1
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'payment_settlement_movements'
        and c.conname = 'payment_settlement_movements_gateway_movement_unique'
    ),
  'unique (gateway_slug, gateway_movement_id) exists'
);

-- Runtime matrix seed
do $seed$
declare
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_other_provider_id uuid := 'a5555555-5555-4555-8555-555555555555'::uuid;
  v_stranger_id uuid := 'a6666666-6666-4666-8666-666666666666'::uuid;
  v_admin_id uuid := 'a7777777-7777-4777-8777-777777777777'::uuid;
  v_sr_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_cs_id uuid := gen_random_uuid();
  v_schedule_id uuid := gen_random_uuid();
  v_tx_id text := 'settlement-tx-1001';
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', (current_date + 3)::text,
    'shift', 'morning'
  );
  v_upsert jsonb;
begin
  perform pg_temp.settlement_seed_user(v_stranger_id, 'client', 'Settlement stranger');
  perform pg_temp.settlement_seed_user(v_admin_id, 'admin', 'Settlement admin');
  perform pg_temp.settlement_seed_user(v_other_provider_id, 'provider', 'Other provider');

  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  if v_client_id is null then
    raise exception 'settlement fixture: seed service_request missing';
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
    'Settlement movements fixture',
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

  -- Keep claim.sub so proposal pricing trigger can call calculate_*; role must be
  -- service_role for payment_upsert_settlement_movements.
  reset role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role', 'sub', v_provider_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);

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
    'bank-account-settlement'
  )
  on conflict (provider_id, gateway_slug) do update
  set
    onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status,
    netcred_company_id = '1048',
    netcred_bank_account_id = coalesce(
      nullif(btrim(provider_gateway_accounts.netcred_bank_account_id), ''),
      excluded.netcred_bank_account_id
    );

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
    'Settlement proposal',
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
    v_tx_id
  );

  v_upsert := public.payment_upsert_settlement_movements(
    jsonb_build_array(
      jsonb_build_object(
        'gateway_slug', 'netcred',
        'gateway_payout_id', 'payout-1',
        'gateway_movement_id', 'mov-provider-1',
        'gateway_transaction_id', v_tx_id,
        'holder_company_id', '1048',
        'payout_status', 'PENDING',
        'movement_status', 'PENDING',
        'movement_type', 'CARD_PAYMENT',
        'movement_source', 'TRANSACTION',
        'record_type', 'CREDIT',
        'installment', 1,
        'gross_amount', '100.00',
        'net_amount', '90.00',
        'base_settle_date', (current_date + 30)::text,
        'settling_at', (current_date + 30)::text,
        'is_advance', false,
        'brand', 'MCC',
        'bank_account_mask', 'Banco X ****1234',
        'sync_source', 'webhook',
        'raw_snapshot', jsonb_build_object('secret_doc', '12345678901', 'full_account', '12345-6')
      ),
      jsonb_build_object(
        'gateway_slug', 'netcred',
        'gateway_payout_id', 'payout-1',
        'gateway_movement_id', 'mov-platform-1',
        'gateway_transaction_id', v_tx_id,
        'holder_company_id', '1014',
        'payout_status', 'PENDING',
        'movement_status', 'PENDING',
        'movement_type', 'CARD_PAYMENT',
        'movement_source', 'TRANSACTION',
        'record_type', 'CREDIT',
        'installment', 1,
        'gross_amount', '10.00',
        'net_amount', '10.00',
        'settling_at', (current_date + 30)::text,
        'sync_source', 'webhook'
      ),
      jsonb_build_object(
        'gateway_slug', 'netcred',
        'gateway_payout_id', 'payout-2',
        'gateway_movement_id', 'mov-orphan-1',
        'gateway_transaction_id', 'missing-tx-999',
        'holder_company_id', '1048',
        'movement_status', 'PENDING',
        'record_type', 'CREDIT',
        'gross_amount', '50.00',
        'net_amount', '45.00',
        'settling_at', (current_date + 10)::text,
        'sync_source', 'webhook'
      ),
      jsonb_build_object(
        'gateway_slug', 'netcred',
        'gateway_payout_id', 'payout-1',
        'gateway_movement_id', 'mov-debit-1',
        'gateway_transaction_id', v_tx_id,
        'holder_company_id', '1048',
        'payout_status', 'PAID_OUT',
        'movement_status', 'PAID_OUT',
        'movement_type', 'REFUND',
        'movement_source', 'REFUND',
        'record_type', 'DEBIT',
        'installment', 1,
        'gross_amount', '20.00',
        'net_amount', '20.00',
        'settling_at', (current_date + 5)::text,
        'settled_at', now()::text,
        'sync_source', 'graphql_reconcile'
      )
    )
  );

  perform set_config('test.settlement.upsert', v_upsert::text, true);
  perform set_config('test.settlement.client_id', v_client_id::text, true);
  perform set_config('test.settlement.provider_id', v_provider_id::text, true);
  perform set_config('test.settlement.other_provider_id', v_other_provider_id::text, true);
  perform set_config('test.settlement.stranger_id', v_stranger_id::text, true);
  perform set_config('test.settlement.admin_id', v_admin_id::text, true);
  perform set_config('test.settlement.schedule_id', v_schedule_id::text, true);
end;
$seed$;

select is(
  (current_setting('test.settlement.upsert')::jsonb->>'upserted')::int,
  2,
  'upsert persists provider CREDIT + DEBIT legs'
);

select is(
  (current_setting('test.settlement.upsert')::jsonb->>'skipped_platform')::int,
  1,
  'upsert skips platform holder_company leg'
);

select is(
  (current_setting('test.settlement.upsert')::jsonb->>'skipped_not_found')::int,
  1,
  'upsert skips movements without matching schedule'
);

select is(
  (
    select count(*)::int
    from public.payment_settlement_movements
    where gateway_movement_id = 'mov-provider-1'
      and is_refund_clawback = false
      and record_type = 'CREDIT'
  ),
  1,
  'CREDIT movement stored without clawback flag'
);

select is(
  (
    select count(*)::int
    from public.payment_settlement_movements
    where gateway_movement_id = 'mov-debit-1'
      and is_refund_clawback = true
      and record_type = 'DEBIT'
  ),
  1,
  'DEBIT movement sets is_refund_clawback'
);

-- Idempotent re-upsert advances status
select lives_ok(
  $$
    select public.payment_upsert_settlement_movements(
      jsonb_build_array(
        jsonb_build_object(
          'gateway_slug', 'netcred',
          'gateway_payout_id', 'payout-1',
          'gateway_movement_id', 'mov-provider-1',
          'gateway_transaction_id', 'settlement-tx-1001',
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
          'bank_account_mask', 'Banco X ****1234',
          'sync_source', 'webhook'
        )
      )
    )
  $$,
  're-upsert same gateway_movement_id succeeds'
);

select is(
  (
    select movement_status
    from public.payment_settlement_movements
    where gateway_movement_id = 'mov-provider-1'
  ),
  'PAID_OUT',
  're-upsert advances movement_status'
);

select pg_temp.settlement_set_auth(current_setting('test.settlement.provider_id')::uuid);

select throws_ok(
  $$ select public.payment_upsert_settlement_movements('[]'::jsonb) $$,
  '42501',
  null,
  'authenticated provider cannot execute upsert (no GRANT)'
);

select is(
  (
    select count(*)::int
    from public.provider_settlement_movements_v
    where gateway_movement_id in ('mov-provider-1', 'mov-debit-1')
  ),
  2,
  'provider owner can read own settlement view rows'
);

select is(
  (
    select count(*)::int
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_settlement_movements_v'
      and column_name = 'raw_snapshot'
  ),
  0,
  'settlement view does not expose raw_snapshot'
);

select pg_temp.settlement_set_auth(current_setting('test.settlement.stranger_id')::uuid);
select is(
  (
    select count(*)::int
    from public.provider_settlement_movements_v
    where gateway_movement_id in ('mov-provider-1', 'mov-debit-1')
  ),
  0,
  'stranger cannot read provider settlement rows via view'
);

select is(
  (
    public.list_provider_settlement_movements(1, 20)->'total_count'
  )::int,
  0,
  'stranger list RPC returns empty total_count'
);

select pg_temp.settlement_set_auth(current_setting('test.settlement.other_provider_id')::uuid);
select is(
  (
    public.list_provider_settlement_movements(1, 20)->'total_count'
  )::int,
  0,
  'other provider list RPC is isolated'
);

select pg_temp.settlement_set_auth(current_setting('test.settlement.provider_id')::uuid);
select is(
  (
    public.list_provider_settlement_movements(1, 20)->'total_count'
  )::int,
  2,
  'owner list RPC returns both movements'
);

select is(
  (
    public.list_provider_settlement_movements(
      1, 20, 'PAID_OUT', null, null, null, null, null
    )->'total_count'
  )::int,
  2,
  'list filter by movement_status=PAID_OUT'
);

select is(
  (
    public.list_provider_settlement_movements(
      1, 20, null, 'DEBIT', null, null, null, null
    )->'total_count'
  )::int,
  1,
  'list filter by record_type=DEBIT'
);

select is(
  jsonb_array_length(
    public.list_provider_settlement_movements(1, 1)->'items'
  ),
  1,
  'list respects page_size'
);

select is(
  (
    public.list_provider_settlement_movements(
      1, 20, null, null, current_date + 25, current_date + 35, null, null
    )->'total_count'
  )::int,
  1,
  'list filter by settling_at date range'
);

select throws_ok(
  $$ select public.list_provider_settlement_movements(1, 20, null, 'INVALID', null, null, null, null) $$,
  '22023',
  null,
  'list rejects invalid record_type'
);

select pg_temp.settlement_set_service_role();

select is(
  (
    select (public.payment_upsert_settlement_movements(
      jsonb_build_array(
        jsonb_build_object(
          'gateway_slug', 'netcred',
          'gateway_payout_id', 'payout-invalid',
          'gateway_movement_id', 'mov-invalid-1',
          'gateway_transaction_id', 'settlement-tx-1001',
          'holder_company_id', '1048',
          'record_type', 'CREDIT'
        )
      )
    )->>'skipped_invalid')::int
  ),
  1,
  'upsert skips invalid movements missing required fields'
);

select throws_ok(
  $$ select public.payment_upsert_settlement_movements('{"not":"array"}'::jsonb) $$,
  '22023',
  null,
  'upsert rejects non-array payload'
);

select pg_temp.settlement_set_auth(current_setting('test.settlement.admin_id')::uuid);
select is(
  (
    select count(*)::int
    from public.provider_settlement_movements_v
    where gateway_movement_id = 'mov-provider-1'
  ),
  1,
  'platform admin can read settlement view rows'
);

select * from finish();

rollback;
