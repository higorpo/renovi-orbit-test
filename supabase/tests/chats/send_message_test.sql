-- pgTAP: cns_send_message core paths (CNS task 28, design §4.1–4.2).

begin;

\ir fixtures/seed_chat.inc

select plan(8);

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

create or replace function pg_temp.cns_seed_send_message_sr()
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
    'cns_send_message pgTAP fixture',
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

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_send_message'
  ),
  'cns_send_message is SECURITY DEFINER'
);

create temp table _send_sr as
select pg_temp.cns_seed_send_message_sr() as service_request_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _first_send as
select public.cns_send_message(
  'TEXT'::public.cns_message_type,
  'a1111111-1111-4111-8111-111111111111'::uuid,
  jsonb_build_object('text', 'Hello from provider'),
  null,
  (select service_request_id from _send_sr)
) as response;

select is(
  (select response->'conversation'->>'status' from _first_send),
  'ACTIVE',
  'first provider message creates ACTIVE conversation'
);

select is(
  (
    select active_chat_count
    from public.service_request_negotiation_stats
    where service_request_id = (select service_request_id from _send_sr)
  ),
  1,
  'first provider message increments active_chat_count'
);

select ok(
  (
    select exists (
      select 1
      from message_dispatcher.message_dispatches d
      where d.template_key = 'chat.new_message'
        and d.profile_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid
        and d.bypass_limits = true
        and d.channel = 'push'::message_dispatcher.message_channel
    )
    and not exists (
      select 1
      from public.domain_events de
      where de.event_type = 'CHAT_MESSAGE_SENT'
        and de.chat_id = (select (response->'conversation'->>'id')::uuid from _first_send)
    )
  ),
  'first provider message enqueues chat.new_message push without domain_events'
);

select is(
  (
    select public.cns_send_message(
      'TEXT'::public.cns_message_type,
      'a1111111-1111-4111-8111-111111111111'::uuid,
      jsonb_build_object('text', 'Hello from provider'),
      null,
      (select service_request_id from _send_sr)
    )->'message'->>'id'
  ),
  (select response->'message'->>'id' from _first_send),
  'duplicate idempotency_key returns existing message'
);

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select is(
  (
    select public.cns_send_message(
      'TEXT'::public.cns_message_type,
      'b2222222-2222-4222-8222-222222222222'::uuid,
      jsonb_build_object('text', 'Client reply'),
      (select (response->'conversation'->>'id')::uuid from _first_send),
      null
    )->'message'->>'sender_user_id'
  ),
  '28e30f1d-3c47-441f-94c6-76b6ea0db470',
  'client can send on existing chat via p_chat_id'
);

create temp table _inactive_chat as
select (response->'conversation'->>'id')::uuid as chat_id
from _first_send;

update public.chats
set
  status = 'INACTIVE'::public.cns_conversation_status,
  inactivated_at = now(),
  inactivation_reason = 'NO_RECIPROCITY'::public.cns_inactivation_reason
where id = (select chat_id from _inactive_chat);

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select is(
  (
    select public.cns_send_message(
      'TEXT'::public.cns_message_type,
      'c3333333-3333-4333-8333-333333333333'::uuid,
      jsonb_build_object('text', 'Reactivate'),
      (select chat_id from _inactive_chat),
      null
    )->'conversation'->>'status'
  ),
  'ACTIVE',
  'INACTIVE chat reactivates to ACTIVE on valid message'
);

update public.chats
set
  status = 'CLOSED'::public.cns_conversation_status,
  closed_at = now(),
  closure_type = 'MANUAL'::public.cns_closure_type,
  closed_by_user_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  closure_reason = 'Test close'
where id = (select chat_id from _inactive_chat);

select throws_ok(
  $sql$
    select public.cns_send_message(
      'TEXT'::public.cns_message_type,
      'd4444444-4444-4444-8444-444444444444'::uuid,
      jsonb_build_object('text', 'Should fail'),
      (select chat_id from _inactive_chat),
      null
    );
  $sql$,
  'P0001',
  'CONVERSATION_CLOSED',
  'CLOSED chat rejects send_message'
);

select finish();

rollback;
