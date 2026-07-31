-- pgTAP: payment_schedules_audit CLS mirrors payment_schedules; RLS keeps non-admins out.

begin;

select plan(8);

create or replace function pg_temp.audit_cls_set_auth(p_user_id uuid)
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

create or replace function pg_temp.audit_cls_seed_user(
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
    p_user_id::text || '@audit-cls-test.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', p_name, 'role', case when p_role = 'admin' then 'client' else p_role end)::jsonb,
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

-- Sensitive columns revoked on payment_schedules must also be revoked on audit
select ok(
  not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'payment_schedules'
      and not has_column_privilege(
        'authenticated',
        'public.payment_schedules',
        c.column_name,
        'SELECT'
      )
      and has_column_privilege(
        'authenticated',
        'public.payment_schedules_audit',
        c.column_name,
        'SELECT'
      )
  ),
  'every payment_schedules revoked column is also revoked on payment_schedules_audit'
);

select ok(
  not has_column_privilege('authenticated', 'public.payment_schedules_audit', 'client_ip_address', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules_audit', 'gateway_charge_id', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules_audit', 'gateway_transaction_id', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules_audit', 'gateway_reference_code', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules_audit', 'commission_rate_pct', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules_audit', 'provider_payout', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules_audit', 'base_amount', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules_audit', 'paid_amount', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules_audit', 'claimed_charge_amount', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules_audit', 'client_card_token_id', 'SELECT')
    and not has_column_privilege('authenticated', 'public.payment_schedules_audit', 'idempotency_key', 'SELECT'),
  'authenticated cannot SELECT sensitive audit snapshot columns'
);

select ok(
  has_column_privilege('authenticated', 'public.payment_schedules_audit', 'id', 'SELECT')
    and has_column_privilege('authenticated', 'public.payment_schedules_audit', 'state', 'SELECT')
    and has_column_privilege('authenticated', 'public.payment_schedules_audit', 'audit_id', 'SELECT')
    and has_column_privilege('authenticated', 'public.payment_schedules_audit', 'audit_op', 'SELECT')
    and has_column_privilege('authenticated', 'public.payment_schedules_audit', 'audited_at', 'SELECT')
    and has_column_privilege('authenticated', 'public.payment_schedules_audit', 'row_version', 'SELECT'),
  'authenticated retains SELECT on non-sensitive audit metadata columns'
);

select ok(
  has_table_privilege('service_role', 'public.payment_schedules_audit', 'SELECT')
    and not has_table_privilege('anon', 'public.payment_schedules_audit', 'SELECT'),
  'service_role SELECT kept; anon denied'
);

-- Seed: mutate a schedule so an audit row exists, then assert RLS
do $seed$
declare
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_admin_id uuid := 'a8888888-8888-4888-8888-888888888888'::uuid;
  v_stranger_id uuid := 'a9999999-9999-4999-8999-999999999999'::uuid;
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
  perform pg_temp.audit_cls_seed_user(v_admin_id, 'admin', 'Audit CLS admin');
  perform pg_temp.audit_cls_seed_user(v_stranger_id, 'client', 'Audit CLS stranger');

  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  if v_client_id is null then
    raise exception 'audit CLS fixture: seed service_request missing';
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
    'audit CLS',
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
    'audit CLS proposal',
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
    charge_scheduled_at, state, idempotency_key, gateway_reference_code
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
    now() + interval '1 day',
    'SCHEDULED'::public.payment_schedule_state,
    v_cs_id::text,
    v_cs_id
  );

  perform set_config('test.audit_cls.schedule_id', v_schedule_id::text, true);
  perform set_config('test.audit_cls.admin_id', v_admin_id::text, true);
  perform set_config('test.audit_cls.stranger_id', v_stranger_id::text, true);
  perform set_config('test.audit_cls.client_id', v_client_id::text, true);
end;
$seed$;

select ok(
  (
    select count(*)::int
    from public.payment_schedules_audit
    where id = current_setting('test.audit_cls.schedule_id')::uuid
  ) >= 1,
  'audit row exists for seeded schedule (owner/postgres read)'
);

select pg_temp.audit_cls_set_auth(current_setting('test.audit_cls.stranger_id')::uuid);

select is(
  (
    select count(*)::int
    from public.payment_schedules_audit
    where id = current_setting('test.audit_cls.schedule_id')::uuid
  ),
  0,
  'non-admin authenticated cannot see audit rows (RLS)'
);

select pg_temp.audit_cls_set_auth(current_setting('test.audit_cls.client_id')::uuid);

select is(
  (
    select count(*)::int
    from public.payment_schedules_audit
    where id = current_setting('test.audit_cls.schedule_id')::uuid
  ),
  0,
  'participant client cannot see audit rows without admin role'
);

select pg_temp.audit_cls_set_auth(current_setting('test.audit_cls.admin_id')::uuid);

select ok(
  (
    select count(*)::int
    from public.payment_schedules_audit
    where id = current_setting('test.audit_cls.schedule_id')::uuid
  ) >= 1
  and exists (
    select 1
    from public.payment_schedules_audit
    where id = current_setting('test.audit_cls.schedule_id')::uuid
      and audit_op = 'INSERT'
      and state is not null
  ),
  'admin can SELECT non-revoked audit columns via RLS'
);

select * from finish();

rollback;
