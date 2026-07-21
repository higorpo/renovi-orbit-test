-- pgTAP: payment Task 16 — payment history views (design.md §3.13) + CHK-030 tenancy matrix.

begin;

select plan(16);

create or replace function pg_temp.history_set_auth(p_user_id uuid)
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

create or replace function pg_temp.history_seed_user(
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
    p_user_id::text || '@history-test.local',
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
  to_regclass('public.client_payment_transactions_v') is not null,
  'client_payment_transactions_v exists'
);

select ok(
  to_regclass('public.provider_payment_receivables_v') is not null,
  'provider_payment_receivables_v exists'
);

select ok(
  (
    select not coalesce(c.reloptions @> array['security_invoker=true'], false)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'client_payment_transactions_v'
  ),
  'client history view uses definer rights for revoked base columns (CHK-030 invariant)'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_payment_transactions_v'
      and column_name in ('provider_payout', 'amount_received_at_capture')
  ),
  'client view does not expose provider payout columns'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_payment_receivables_v'
      and column_name in ('amount_paid', 'paid_amount', 'service_amount', 'base_amount')
  ),
  'provider view does not expose client paid_amount columns'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_schedules'
      and policyname = 'payment_schedules_select_participant_or_admin'
  ),
  'payment_schedules SELECT policy scopes direct participant reads on base table'
);

select ok(
  has_table_privilege('authenticated', 'public.client_payment_transactions_v', 'SELECT')
    and not has_table_privilege('anon', 'public.client_payment_transactions_v', 'SELECT'),
  'authenticated SELECT on client view; anon denied'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_schedules'
      and indexname = 'payment_schedules_client_paid_history_idx'
  ),
  'client paid history index exists'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_schedules'
      and indexname = 'payment_schedules_provider_paid_history_idx'
  ),
  'provider paid history index exists'
);

select ok(
  (
    select pg_get_viewdef('public.client_payment_transactions_v'::regclass, true)
      ~ 'is_platform_admin'
      and pg_get_viewdef('public.client_payment_transactions_v'::regclass, true)
      ~ 'auth.uid'
  ),
  'CHK-030: client history view WHERE includes auth.uid() and is_platform_admin()'
);

-- CHK-030 runtime matrix (owner vs stranger). Pricing via calculate_provider_service_pricing.
do $seed$
declare
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_stranger_id uuid := 'a3333333-3333-4333-8333-333333333333'::uuid;
  v_admin_id uuid := 'a4444444-4444-4444-8444-444444444444'::uuid;
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
  perform pg_temp.history_seed_user(v_stranger_id, 'client', 'History stranger');
  perform pg_temp.history_seed_user(v_admin_id, 'admin', 'History admin');

  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  if v_client_id is null then
    raise exception 'CHK-030 fixture: seed service_request missing';
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
    'CHK-030 history',
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
    'CHK-030 history proposal',
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

  perform set_config('test.history.client_id', v_client_id::text, true);
  perform set_config('test.history.provider_id', v_provider_id::text, true);
  perform set_config('test.history.stranger_id', v_stranger_id::text, true);
  perform set_config('test.history.admin_id', v_admin_id::text, true);
  perform set_config('test.history.schedule_id', v_schedule_id::text, true);
end;
$seed$;

select pg_temp.history_set_auth(current_setting('test.history.client_id')::uuid);
select is(
  (
    select count(*)::int
    from public.client_payment_transactions_v
    where schedule_id = current_setting('test.history.schedule_id')::uuid
  ),
  1,
  'CHK-030: client owner can read own client history row'
);

select pg_temp.history_set_auth(current_setting('test.history.provider_id')::uuid);
select is(
  (
    select count(*)::int
    from public.provider_payment_receivables_v
    where schedule_id = current_setting('test.history.schedule_id')::uuid
  ),
  1,
  'CHK-030: provider owner can read own receivables row'
);

select pg_temp.history_set_auth(current_setting('test.history.stranger_id')::uuid);
select is(
  (
    select count(*)::int
    from public.client_payment_transactions_v
    where schedule_id = current_setting('test.history.schedule_id')::uuid
  ),
  0,
  'CHK-030: stranger cannot read client history row'
);

select is(
  (
    select count(*)::int
    from public.provider_payment_receivables_v
    where schedule_id = current_setting('test.history.schedule_id')::uuid
  ),
  0,
  'CHK-030: stranger cannot read provider receivables row'
);

select pg_temp.history_set_auth(current_setting('test.history.admin_id')::uuid);
select is(
  (
    select count(*)::int
    from public.client_payment_transactions_v
    where schedule_id = current_setting('test.history.schedule_id')::uuid
  ),
  1,
  'CHK-030: platform admin can read client history row'
);

select is(
  (
    select count(*)::int
    from public.provider_payment_receivables_v
    where schedule_id = current_setting('test.history.schedule_id')::uuid
  ),
  1,
  'CHK-030: platform admin can read provider receivables row'
);

select * from finish();

rollback;
