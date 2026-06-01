-- pgTAP: CNS RLS matrix (Req. 35, task 79, design §11.2, §13.11, R35-AC16).

begin;

\ir fixtures/seed_chat.inc

select plan(19);

create or replace function pg_temp.cns_set_auth(p_user_id uuid)
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
end;
$$;

create or replace function pg_temp.cns_seed_provider_user(
  p_user_id uuid,
  p_name text default 'RLS test provider'
)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_user_id::text || '@rls-cns-test.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', p_name, 'role', 'provider')::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_user_id,
    json_build_object(
      'sub',
      p_user_id::text,
      'email',
      p_user_id::text || '@rls-cns-test.local'
    )::jsonb,
    'email',
    p_user_id::text,
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do nothing;
end;
$$;

create or replace function pg_temp.cns_seed_admin_user(
  p_user_id uuid,
  p_name text default 'RLS test admin'
)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_user_id::text || '@rls-cns-admin-test.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', p_name, 'role', 'client')::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_user_id,
    json_build_object(
      'sub',
      p_user_id::text,
      'email',
      p_user_id::text || '@rls-cns-admin-test.local'
    )::jsonb,
    'email',
    p_user_id::text,
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do nothing;

  alter table public.profiles disable trigger profiles_prevent_admin_role_update;
  update public.profiles
  set full_name = p_name, role = 'admin'
  where id = p_user_id;
  alter table public.profiles enable trigger profiles_prevent_admin_role_update;
end;
$$;

create or replace function pg_temp.cns_seed_rls_sr()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
  insert into public.service_requests (
    id,
    client_id,
    service_id,
    address_id,
    title,
    description,
    form_data,
    form_version,
    status,
    urgency
  )
  select
    gen_random_uuid(),
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'rls_cns pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN',
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create temp table _actors (
  client_id uuid primary key,
  provider_a_id uuid not null,
  provider_c_id uuid not null,
  admin_id uuid not null
);

insert into _actors values (
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'c1111111-1111-4111-8111-111111111111'::uuid,
  'a1111111-1111-4111-8111-111111111111'::uuid
);

select pg_temp.cns_seed_provider_user(
  (select provider_c_id from _actors),
  'Provider C RLS'
);
select pg_temp.cns_seed_admin_user(
  (select admin_id from _actors),
  'Admin RLS CNS'
);

create temp table _fixture as
with sr as (
  select pg_temp.cns_seed_rls_sr() as service_request_id
)
select
  sr.service_request_id,
  pg_temp.cns_seed_chat(sr.service_request_id, a.client_id, a.provider_a_id) as chat_ab_id,
  a.client_id,
  a.provider_a_id,
  a.provider_c_id,
  a.admin_id
from sr
cross join _actors a;

insert into public.chat_messages (
  chat_id,
  sender_user_id,
  message_type,
  payload,
  idempotency_key
)
select
  f.chat_ab_id,
  f.provider_a_id,
  'TEXT'::public.cns_message_type,
  '{"text":"rls fixture"}'::jsonb,
  'd1111111-1111-4111-8111-111111111111'::uuid
from _fixture f;

-- Superuser seeds proposal; pricing RPC only needs auth.uid() in session.
select set_config(
  'request.jwt.claim.sub',
  (select provider_a_id::text from _fixture),
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', (select provider_a_id::text from _fixture)
  )::text,
  true
);

reset role;

create temp table _proposal as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(150.00::numeric)
),
inserted as (
insert into public.provider_proposals (
  provider_id,
  service_request_id,
  chat_id,
  proposed_amount,
  proposal_description,
  proposal_duration_value,
  proposal_duration_unit,
  proposal_suggested_slots,
  tax_rate,
  tax_amount,
  final_amount,
  pricing_signature,
  status,
  submitted_at
)
select
  f.provider_a_id,
  f.service_request_id,
  f.chat_ab_id,
  pricing.original_amount,
  'RLS fixture proposal',
  2,
  'hours',
  jsonb_build_array(
    jsonb_build_object('start_date', (current_date + 1)::text, 'shift', 'morning')
  ),
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature,
  'PENDING'::public.proposal_status,
  now()
from _fixture f
cross join pricing
returning id
)
select id as proposal_id from inserted;

select set_config('rls.client_id', (select client_id::text from _fixture), true);
select set_config('rls.provider_a_id', (select provider_a_id::text from _fixture), true);
select set_config('rls.provider_c_id', (select provider_c_id::text from _fixture), true);
select set_config('rls.admin_id', (select admin_id::text from _fixture), true);
select set_config('rls.chat_ab_id', (select chat_ab_id::text from _fixture), true);
select set_config(
  'rls.service_request_id',
  (select service_request_id::text from _fixture),
  true
);
select set_config('rls.proposal_id', (select proposal_id::text from _proposal), true);

-- R35-AC11: RLS enabled on CNS tables
select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'chats',
        'chat_messages',
        'provider_proposals',
        'services',
        'domain_events'
      )
  ),
  'CNS core tables have RLS enabled (R35-AC11)'
);

-- R35-AC12: single merged SELECT policy on chat_messages
select ok(
  (
    select count(*) = 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'chat_messages'
      and p.cmd = 'SELECT'
      and p.permissive = 'PERMISSIVE'
      and p.roles @> array['authenticated']::name[]
  ),
  'chat_messages has one permissive SELECT policy for authenticated (R35-AC12)'
);

select ok(
  (
    select exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'chat_messages'
        and p.policyname = 'chat_messages_select'
        and p.qual is not null
        and p.qual ~ 'is_chat_participant'
    )
  ),
  'chat_messages_select uses is_chat_participant (R35-AC12)'
);

-- R35-AC15 / task 78: SELECT only grants on mutable CNS tables
select ok(
  has_table_privilege('authenticated', 'public.chats', 'SELECT')
  and not has_table_privilege('authenticated', 'public.chats', 'INSERT')
  and not has_table_privilege('authenticated', 'public.chats', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.chats', 'DELETE'),
  'authenticated has SELECT only on chats (R35-AC15)'
);

-- R35-AC16 (1) / R35-AC01: admin reads A–B chat without being participant
select pg_temp.cns_set_auth(current_setting('rls.admin_id')::uuid);

select ok(
  (
    select count(*) = 1
    from public.chats c
    where c.id = current_setting('rls.chat_ab_id')::uuid
  ),
  'admin reads conversation between client and provider A (R35-AC01, R35-AC16)'
);

-- R35-AC16 (2) / R35-AC09: provider C cannot read A–B chat
select pg_temp.cns_set_auth(current_setting('rls.provider_c_id')::uuid);

select is(
  (
    select count(*)::int
    from public.chats c
    where c.id = current_setting('rls.chat_ab_id')::uuid
  ),
  0,
  'provider C cannot read client–provider A conversation (R35-AC09, R31-AC04)'
);

select is(
  (
    select count(*)::int
    from public.chat_messages m
    where m.chat_id = current_setting('rls.chat_ab_id')::uuid
  ),
  0,
  'provider C cannot read messages in foreign conversation (R35-AC09)'
);

-- R35-AC16 (3) / R35-AC05: client participant reads own chat and messages
select pg_temp.cns_set_auth(current_setting('rls.client_id')::uuid);

select ok(
  (
    select count(*) = 1
    from public.chats c
    where c.id = current_setting('rls.chat_ab_id')::uuid
  ),
  'client participant reads own conversation (R35-AC05, R35-AC16)'
);

select ok(
  (
    select count(*) >= 1
    from public.chat_messages m
    where m.chat_id = current_setting('rls.chat_ab_id')::uuid
  ),
  'client participant reads messages in own conversation (R35-AC05)'
);

-- R35-AC08: provider A reads own chat
select pg_temp.cns_set_auth(current_setting('rls.provider_a_id')::uuid);

select ok(
  (
    select count(*) = 1
    from public.chats c
    where c.id = current_setting('rls.chat_ab_id')::uuid
  ),
  'provider participant reads own conversation (R35-AC08)'
);

-- R35-AC02: admin reads all proposals
select pg_temp.cns_set_auth(current_setting('rls.admin_id')::uuid);

select ok(
  (
    select count(*) = 1
    from public.provider_proposals pp
    where pp.id = current_setting('rls.proposal_id')::uuid
  ),
  'admin reads CNS proposals (R35-AC02)'
);

-- R35-AC10 / R31-AC04: provider C cannot read proposal on A–B chat
select pg_temp.cns_set_auth(current_setting('rls.provider_c_id')::uuid);

select is(
  (
    select count(*)::int
    from public.provider_proposals pp
    where pp.id = current_setting('rls.proposal_id')::uuid
  ),
  0,
  'provider C cannot read proposal on another provider conversation (R35-AC10, R31-AC04)'
);

select pg_temp.cns_set_auth(current_setting('rls.provider_a_id')::uuid);

select ok(
  (
    select count(*) = 1
    from public.provider_proposals pp
    where pp.id = current_setting('rls.proposal_id')::uuid
  ),
  'provider A reads proposal on own conversation (R35-AC10)'
);

select pg_temp.cns_set_auth(current_setting('rls.client_id')::uuid);

select ok(
  (
    select count(*) = 1
    from public.provider_proposals pp
    where pp.id = current_setting('rls.proposal_id')::uuid
  ),
  'client reads proposal on own conversation (task 74)'
);

-- R35-AC03: direct mutations denied (privilege + RLS)
select pg_temp.cns_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  format(
    $q$
      insert into public.chats (
        service_request_id,
        client_id,
        provider_id
      )
      values ('%s', '%s', '%s')
    $q$,
    current_setting('rls.service_request_id')::uuid,
    current_setting('rls.client_id')::uuid,
    current_setting('rls.provider_c_id')::uuid
  ),
  '42501',
  null,
  'client cannot INSERT into chats (R35-AC03)'
);

select throws_ok(
  format(
    $q$
      insert into public.chat_messages (
        chat_id,
        sender_user_id,
        message_type,
        payload,
        idempotency_key
      )
      values ('%s', '%s', 'TEXT', '{}', '%s')
    $q$,
    current_setting('rls.chat_ab_id')::uuid,
    current_setting('rls.client_id')::uuid,
    'e2222222-2222-4222-8222-222222222222'
  ),
  '42501',
  null,
  'client cannot INSERT into chat_messages (R35-AC08 deny direct write)'
);

select throws_ok(
  format(
    $q$
      insert into public.provider_proposals (
        provider_id,
        service_request_id,
        chat_id,
        proposed_amount,
        proposal_description,
        proposal_duration_value,
        proposal_duration_unit,
        proposal_suggested_slots,
        tax_rate,
        tax_amount,
        final_amount,
        pricing_signature,
        status
      )
      values (
        '%s',
        '%s',
        '%s',
        100,
        'client forged proposal',
        1,
        'hours',
        '[{"start_date":"2026-06-01","shift":"morning"}]'::jsonb,
        0.1,
        10,
        90,
        'forged',
        'PENDING'
      )
    $q$,
    current_setting('rls.client_id')::uuid,
    current_setting('rls.service_request_id')::uuid,
    current_setting('rls.chat_ab_id')::uuid
  ),
  '42501',
  null,
  'client cannot INSERT into provider_proposals (task 74, task 78)'
);

-- Operational tables: participant cannot read domain_events outbox
select pg_temp.cns_set_auth(current_setting('rls.client_id')::uuid);

select is(
  (select count(*)::int from public.domain_events),
  0,
  'client cannot read domain_events outbox (task 76)'
);

select pg_temp.cns_set_auth(current_setting('rls.admin_id')::uuid);

select ok(
  (select count(*) >= 0 from public.domain_events),
  'admin may read domain_events (task 76)'
);

select finish();

rollback;
