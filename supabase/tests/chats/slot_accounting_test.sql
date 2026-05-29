-- pgTAP: slot accounting matrix (CNS task 41, design §3.3.1, Req. 4, 33).

begin;

\ir fixtures/seed_chat.inc
\ir fixtures/seed_reciprocity_messages.inc

select plan(10);

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

create or replace function pg_temp.cns_seed_provider_user(p_user_id uuid, p_name text default 'Slot test provider')
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
    p_user_id::text || '@slot-test.local',
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
      p_user_id::text || '@slot-test.local'
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

create or replace function pg_temp.cns_seed_slot_sr()
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
    'slot accounting pgTAP fixture',
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

create or replace function pg_temp.cns_provider_first_message(
  p_provider_id uuid,
  p_service_request_id uuid,
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
as $$
begin
  perform pg_temp.cns_set_auth(p_provider_id);
  return public.cns_send_message(
    'TEXT'::public.cns_message_type,
    p_idempotency_key,
    jsonb_build_object('text', 'First message'),
    null,
    p_service_request_id
  );
end;
$$;

create or replace function pg_temp.cns_seed_stale_active_chat(
  p_service_request_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_chat_id uuid;
begin
  v_chat_id := pg_temp.cns_seed_chat(
    p_service_request_id := p_service_request_id,
    p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    p_status := 'ACTIVE'::public.cns_conversation_status,
    p_last_interaction_at := now() - interval '25 hours'
  );

  insert into public.service_request_negotiation_stats (
    service_request_id,
    active_chat_count
  )
  values (p_service_request_id, 1)
  on conflict (service_request_id) do update
    set active_chat_count = 1;

  return v_chat_id;
end;
$$;

select pg_temp.cns_seed_provider_user('b1111111-1111-4111-8111-111111111111'::uuid, 'Provider B');
select pg_temp.cns_seed_provider_user('b2222222-2222-4222-8222-222222222222'::uuid, 'Provider C');
select pg_temp.cns_seed_provider_user('b3333333-3333-4333-8333-333333333333'::uuid, 'Provider D');

select is(
  public.platform_constant_int('chats.max_active_slots_per_service_request', 4),
  4,
  'seeded slot limit defaults to 4 (R33-AC07)'
);

-- §3.3.1: new (sr, provider) → ACTIVE increments counter (+1).
create temp table _new_slot_case as
select pg_temp.cns_seed_slot_sr() as service_request_id;

select pg_temp.cns_provider_first_message(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _new_slot_case),
  'c1000001-0001-4001-8001-000000000001'::uuid
);

select is(
  (
    select active_chat_count
    from public.service_request_negotiation_stats
    where service_request_id = (select service_request_id from _new_slot_case)
  ),
  1,
  'new provider chat increments active_chat_count by one (R4-AC01)'
);

-- §3.3.1: INACTIVE → ACTIVE reactivation does not increment counter (0 delta).
create temp table _reactivate_sr as
select pg_temp.cns_seed_slot_sr() as service_request_id;

create temp table _reactivate_first as
select pg_temp.cns_provider_first_message(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _reactivate_sr),
  'c2000001-0001-4001-8001-000000000001'::uuid
) as first_send;

update public.chats
set
  status = 'INACTIVE'::public.cns_conversation_status,
  inactivated_at = now(),
  inactivation_reason = 'NO_RECIPROCITY'::public.cns_inactivation_reason
where id = (select (first_send->'conversation'->>'id')::uuid from _reactivate_first);

select pg_temp.cns_provider_first_message(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _reactivate_sr),
  'c2000002-0002-4002-8002-000000000002'::uuid
);

select is(
  (
    select active_chat_count
    from public.service_request_negotiation_stats
    where service_request_id = (select service_request_id from _reactivate_sr)
  ),
  1,
  'INACTIVE reactivation leaves active_chat_count unchanged (§3.3.1 delta 0)'
);

-- §3.3.1: ACTIVE → INACTIVE (reciprocity) decrements counter (−1).
create temp table _inactive_case as
with sr as (
  select pg_temp.cns_seed_slot_sr() as sr_id
)
select
  sr.sr_id,
  pg_temp.cns_seed_stale_active_chat(sr.sr_id) as chat_id
from sr;

insert into public.service_request_negotiation_stats (service_request_id, active_chat_count)
select sr_id, 1
from _inactive_case
on conflict (service_request_id) do update
  set active_chat_count = 1;

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _inactive_case),
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  'TEXT'::public.cns_message_type,
  now() - interval '25 hours'
);

select public.cns_evaluate_reciprocity_batch(500);

select is(
  (
    select active_chat_count
    from public.service_request_negotiation_stats
    where service_request_id = (select sr_id from _inactive_case)
  ),
  0,
  'reciprocity INACTIVE decrements active_chat_count by one'
);

-- §3.3.1: accept cascade resets counter to 0.
create temp table _accept_reset_case as
select pg_temp.cns_seed_slot_sr() as service_request_id;

create temp table _accept_reset_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _accept_reset_case),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

insert into public.service_request_negotiation_stats (service_request_id, active_chat_count)
select service_request_id, 1
from _accept_reset_case
on conflict (service_request_id) do update
  set active_chat_count = 1;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _accept_reset_submit as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(350.00::numeric)
)
select public.submit_proposal(
  (select chat_id from _accept_reset_chat),
  'c4000001-0001-4001-8001-000000000001'::uuid,
  pricing.original_amount,
  'Accept slot reset fixture',
  2,
  'hours',
  jsonb_build_array(
    jsonb_build_object(
      'start_date', (current_date + 2)::text,
      'shift', 'morning'
    )
  ),
  pricing.pricing_signature,
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount
) as submit_response
from pricing;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.accept_proposal(
  (select (submit_response->'proposal'->>'id')::uuid from _accept_reset_submit),
  jsonb_build_object(
    'start_date', (current_date + 2)::text,
    'shift', 'morning'
  ),
  'c4000002-0002-4002-8002-000000000002'::uuid
);

select is(
  (
    select active_chat_count
    from public.service_request_negotiation_stats
    where service_request_id = (select service_request_id from _accept_reset_case)
  ),
  0,
  'accept cascade resets active_chat_count to zero'
);

-- R33-AC07 / R4-AC06: override limit to 2; third new chat MUST fail.
update public.platform_constants
set value = '2'::jsonb
where key = 'chats.max_active_slots_per_service_request';

create temp table _limit_two_case as
select pg_temp.cns_seed_slot_sr() as service_request_id;

select pg_temp.cns_provider_first_message(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _limit_two_case),
  'c5000001-0001-4001-8001-000000000001'::uuid
);

select pg_temp.cns_provider_first_message(
  'b1111111-1111-4111-8111-111111111111'::uuid,
  (select service_request_id from _limit_two_case),
  'c5000002-0002-4002-8002-000000000002'::uuid
);

select throws_ok(
  $sql$
    select pg_temp.cns_provider_first_message(
      'b2222222-2222-4222-8222-222222222222'::uuid,
      (select service_request_id from _limit_two_case),
      'c5000003-0003-4003-8003-000000000003'::uuid
    );
  $sql$,
  'P0001',
  'NO_ACTIVE_SLOT',
  'third new chat rejected when slot limit is 2 (R33-AC07, R4-AC06)'
);

-- R4-AC09: last-slot contention — first provider wins, second gets NO_ACTIVE_SLOT.
create temp table _last_slot_case as
select pg_temp.cns_seed_slot_sr() as service_request_id;

select pg_temp.cns_provider_first_message(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _last_slot_case),
  'c6000001-0001-4001-8001-000000000001'::uuid
);

select lives_ok(
  $sql$
    select pg_temp.cns_provider_first_message(
      'b1111111-1111-4111-8111-111111111111'::uuid,
      (select service_request_id from _last_slot_case),
      'c6000002-0002-4002-8002-000000000002'::uuid
    );
  $sql$,
  'first contender claims the last available slot (R4-AC09)'
);

select throws_ok(
  $sql$
    select pg_temp.cns_provider_first_message(
      'b2222222-2222-4222-8222-222222222222'::uuid,
      (select service_request_id from _last_slot_case),
      'c6000003-0003-4003-8003-000000000003'::uuid
    );
  $sql$,
  'P0001',
  'NO_ACTIVE_SLOT',
  'second contender loses last-slot race with predictable error (R4-AC09)'
);

-- Reactivation when counter is at limit is allowed without consuming a slot.
create temp table _reactivate_at_limit_case as
select pg_temp.cns_seed_slot_sr() as service_request_id;

create temp table _reactivate_at_limit_chat_a as
select pg_temp.cns_provider_first_message(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _reactivate_at_limit_case),
  'c7000001-0001-4001-8001-000000000001'::uuid
) as chat_a;

select pg_temp.cns_provider_first_message(
  'b1111111-1111-4111-8111-111111111111'::uuid,
  (select service_request_id from _reactivate_at_limit_case),
  'c7000002-0002-4002-8002-000000000002'::uuid
);

update public.chats
set
  status = 'INACTIVE'::public.cns_conversation_status,
  inactivated_at = now(),
  inactivation_reason = 'NO_RECIPROCITY'::public.cns_inactivation_reason
where id = (select (chat_a->'conversation'->>'id')::uuid from _reactivate_at_limit_chat_a);

update public.service_request_negotiation_stats
set active_chat_count = active_chat_count - 1
where service_request_id = (select service_request_id from _reactivate_at_limit_case);

select pg_temp.cns_provider_first_message(
  'b2222222-2222-4222-8222-222222222222'::uuid,
  (select service_request_id from _reactivate_at_limit_case),
  'c7000003-0003-4003-8003-000000000003'::uuid
);

select pg_temp.cns_provider_first_message(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _reactivate_at_limit_case),
  'c7000004-0004-4004-8004-000000000004'::uuid
);

select is(
  (
    select active_chat_count
    from public.service_request_negotiation_stats
    where service_request_id = (select service_request_id from _reactivate_at_limit_case)
  ),
  2,
  'reactivation at limit does not increment active_chat_count'
);

select ok(
  (
    select count(*)::int
    from public.chats c
    where c.service_request_id = (select service_request_id from _reactivate_at_limit_case)
      and c.status = 'ACTIVE'::public.cns_conversation_status
  ) > public.platform_constant_int('chats.max_active_slots_per_service_request', 4),
  'ACTIVE row count may temporarily exceed slot limit after reactivation (§3.3.1)'
);

select finish();

rollback;
