-- pgTAP: payment history / safe views — SELECT allowed; DML denied for authenticated.

begin;

select plan(12);

create or replace function pg_temp.dml_set_auth(p_user_id uuid)
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

create or replace function pg_temp.dml_seed_user(
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
    p_user_id::text || '@view-dml-test.local',
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
  values (p_user_id, p_name, p_role)
  on conflict (id) do update set full_name = excluded.full_name;
end;
$$;

-- Privilege surface: SELECT only for authenticated on all four views
select ok(
  has_table_privilege('authenticated', 'public.client_payment_transactions_v', 'SELECT')
    and not has_table_privilege('authenticated', 'public.client_payment_transactions_v', 'INSERT')
    and not has_table_privilege('authenticated', 'public.client_payment_transactions_v', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.client_payment_transactions_v', 'DELETE')
    and not has_table_privilege('authenticated', 'public.client_payment_transactions_v', 'TRUNCATE'),
  'client_payment_transactions_v: authenticated SELECT only'
);

select ok(
  has_table_privilege('authenticated', 'public.provider_payment_receivables_v', 'SELECT')
    and not has_table_privilege('authenticated', 'public.provider_payment_receivables_v', 'INSERT')
    and not has_table_privilege('authenticated', 'public.provider_payment_receivables_v', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.provider_payment_receivables_v', 'DELETE')
    and not has_table_privilege('authenticated', 'public.provider_payment_receivables_v', 'TRUNCATE'),
  'provider_payment_receivables_v: authenticated SELECT only'
);

select ok(
  has_table_privilege('authenticated', 'public.provider_settlement_movements_v', 'SELECT')
    and not has_table_privilege('authenticated', 'public.provider_settlement_movements_v', 'INSERT')
    and not has_table_privilege('authenticated', 'public.provider_settlement_movements_v', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.provider_settlement_movements_v', 'DELETE')
    and not has_table_privilege('authenticated', 'public.provider_settlement_movements_v', 'TRUNCATE'),
  'provider_settlement_movements_v: authenticated SELECT only'
);

select ok(
  has_table_privilege('authenticated', 'public.client_card_tokens_safe_v', 'SELECT')
    and not has_table_privilege('authenticated', 'public.client_card_tokens_safe_v', 'INSERT')
    and not has_table_privilege('authenticated', 'public.client_card_tokens_safe_v', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.client_card_tokens_safe_v', 'DELETE')
    and not has_table_privilege('authenticated', 'public.client_card_tokens_safe_v', 'TRUNCATE'),
  'client_card_tokens_safe_v: authenticated SELECT only'
);

-- Runtime: client with a paid schedule can SELECT; DML via view is denied
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
    raise exception 'view DML deny fixture: seed service_request missing';
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
    'view DML deny',
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
    'view DML deny proposal',
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
    gateway_reference_code
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
    v_cs_id
  );

  perform set_config('test.view_dml.client_id', v_client_id::text, true);
  perform set_config('test.view_dml.schedule_id', v_schedule_id::text, true);
end;
$seed$;

select pg_temp.dml_set_auth(current_setting('test.view_dml.client_id')::uuid);

select ok(
  (
    select count(*)::int
    from public.client_payment_transactions_v
    where schedule_id = current_setting('test.view_dml.schedule_id')::uuid
  ) = 1,
  'client SELECT on client_payment_transactions_v sees paid schedule'
);

select throws_ok(
  format(
    $$update public.client_payment_transactions_v set is_disputed = true where schedule_id = %L$$,
    current_setting('test.view_dml.schedule_id')
  ),
  '42501',
  null,
  'client UPDATE via client_payment_transactions_v is denied'
);

select throws_ok(
  format(
    $$delete from public.client_payment_transactions_v where schedule_id = %L$$,
    current_setting('test.view_dml.schedule_id')
  ),
  '42501',
  null,
  'client DELETE via client_payment_transactions_v is denied'
);

select throws_ok(
  $$insert into public.client_payment_transactions_v (
    schedule_id, contracted_service_id, client_id, amount_paid, service_amount,
    installment_number, paid_at, refunded_amount, refunded_at, state, is_disputed, created_at
  ) values (
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1, 1,
    1, now(), null, null, 'PAID', false, now()
  )$$,
  '42501',
  null,
  'client INSERT via client_payment_transactions_v is denied'
);

select throws_ok(
  $$update public.provider_payment_receivables_v set is_disputed = true$$,
  '42501',
  null,
  'authenticated UPDATE via provider_payment_receivables_v is denied'
);

select throws_ok(
  $$update public.provider_settlement_movements_v set brand = 'x'$$,
  '42501',
  null,
  'authenticated UPDATE via provider_settlement_movements_v is denied'
);

select throws_ok(
  $$update public.client_card_tokens_safe_v set cardholder_name = 'x'$$,
  '42501',
  null,
  'authenticated UPDATE via client_card_tokens_safe_v is denied'
);

select ok(
  not has_table_privilege('anon', 'public.client_payment_transactions_v', 'SELECT')
    and not has_table_privilege('anon', 'public.provider_payment_receivables_v', 'SELECT')
    and not has_table_privilege('anon', 'public.provider_settlement_movements_v', 'SELECT')
    and not has_table_privilege('anon', 'public.client_card_tokens_safe_v', 'SELECT'),
  'anon has no SELECT on payment read-model views'
);

select * from finish();

rollback;
