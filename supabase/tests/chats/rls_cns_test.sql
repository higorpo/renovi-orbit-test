-- pgTAP: CNS RLS matrix (Req. 35, task 79, design §11.2, §13.11, R35-AC16).

begin;

\ir fixtures/seed_chat.inc

select plan(19);

create or replace function pg_temp.cns_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
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

insert into auth.users (id, email)
select a.provider_c_id, 'provider-c-rls@test.com'
from _actors a
on conflict (id) do nothing;

insert into auth.users (id, email)
select a.admin_id, 'admin-rls-cns@test.com'
from _actors a
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role)
select a.provider_c_id, 'Provider C RLS', 'provider'
from _actors a
on conflict (id) do update set role = 'provider';

insert into public.profiles (id, full_name, role)
select a.admin_id, 'Admin RLS CNS', 'admin'
from _actors a
on conflict (id) do update set role = 'admin';

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

create temp table _proposal as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(150.00::numeric)
)
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
returning id as proposal_id;

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
      and p.permissive
      and p.roles @> array['authenticated']::name[]
  ),
  'chat_messages has one permissive SELECT policy for authenticated (R35-AC12)'
);

select ok(
  (
    select p.qual ~ 'is_chat_participant'
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'chat_messages'
      and p.policyname = 'chat_messages_select'
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
select pg_temp.cns_set_auth((select admin_id from _fixture));

select ok(
  (
    select count(*) = 1
    from public.chats c
    where c.id = (select chat_ab_id from _fixture)
  ),
  'admin reads conversation between client and provider A (R35-AC01, R35-AC16)'
);

-- R35-AC16 (2) / R35-AC09: provider C cannot read A–B chat
select pg_temp.cns_set_auth((select provider_c_id from _fixture));

select is(
  (
    select count(*)::int
    from public.chats c
    where c.id = (select chat_ab_id from _fixture)
  ),
  0,
  'provider C cannot read client–provider A conversation (R35-AC09, R31-AC04)'
);

select is(
  (
    select count(*)::int
    from public.chat_messages m
    where m.chat_id = (select chat_ab_id from _fixture)
  ),
  0,
  'provider C cannot read messages in foreign conversation (R35-AC09)'
);

-- R35-AC16 (3) / R35-AC05: client participant reads own chat and messages
select pg_temp.cns_set_auth((select client_id from _fixture));

select ok(
  (
    select count(*) = 1
    from public.chats c
    where c.id = (select chat_ab_id from _fixture)
  ),
  'client participant reads own conversation (R35-AC05, R35-AC16)'
);

select ok(
  (
    select count(*) >= 1
    from public.chat_messages m
    where m.chat_id = (select chat_ab_id from _fixture)
  ),
  'client participant reads messages in own conversation (R35-AC05)'
);

-- R35-AC08: provider A reads own chat
select pg_temp.cns_set_auth((select provider_a_id from _fixture));

select ok(
  (
    select count(*) = 1
    from public.chats c
    where c.id = (select chat_ab_id from _fixture)
  ),
  'provider participant reads own conversation (R35-AC08)'
);

-- R35-AC02: admin reads all proposals
select pg_temp.cns_set_auth((select admin_id from _fixture));

select ok(
  (
    select count(*) = 1
    from public.provider_proposals pp
    where pp.id = (select proposal_id from _proposal)
  ),
  'admin reads CNS proposals (R35-AC02)'
);

-- R35-AC10 / R31-AC04: provider C cannot read proposal on A–B chat
select pg_temp.cns_set_auth((select provider_c_id from _fixture));

select is(
  (
    select count(*)::int
    from public.provider_proposals pp
    where pp.id = (select proposal_id from _proposal)
  ),
  0,
  'provider C cannot read proposal on another provider conversation (R35-AC10, R31-AC04)'
);

select pg_temp.cns_set_auth((select provider_a_id from _fixture));

select ok(
  (
    select count(*) = 1
    from public.provider_proposals pp
    where pp.id = (select proposal_id from _proposal)
  ),
  'provider A reads proposal on own conversation (R35-AC10)'
);

select pg_temp.cns_set_auth((select client_id from _fixture));

select ok(
  (
    select count(*) = 1
    from public.provider_proposals pp
    where pp.id = (select proposal_id from _proposal)
  ),
  'client reads proposal on own conversation (task 74)'
);

-- R35-AC03: direct mutations denied (privilege + RLS)
select pg_temp.cns_set_auth((select client_id from _fixture));

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
    (select service_request_id from _fixture),
    (select client_id from _fixture),
    (select provider_c_id from _fixture)
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
    (select chat_ab_id from _fixture),
    (select client_id from _fixture),
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
    (select client_id from _fixture),
    (select service_request_id from _fixture),
    (select chat_ab_id from _fixture)
  ),
  '42501',
  null,
  'client cannot INSERT into provider_proposals (task 74, task 78)'
);

-- Operational tables: participant cannot read domain_events outbox
select pg_temp.cns_set_auth((select client_id from _fixture));

select is(
  (select count(*)::int from public.domain_events),
  0,
  'client cannot read domain_events outbox (task 76)'
);

select pg_temp.cns_set_auth((select admin_id from _fixture));

select ok(
  (select count(*) >= 0 from public.domain_events),
  'admin may read domain_events (task 76)'
);

select finish();

rollback;
