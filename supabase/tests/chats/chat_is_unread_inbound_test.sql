-- pgTAP: inbound-only unread detection for service cards and chat inbox.

begin;

\ir fixtures/seed_chat.inc

select plan(7);

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

create temp table _unread_fixture as
select
  pg_temp.cns_seed_chat(
    p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ) as chat_id,
  '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid as service_request_id,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid as client_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid as provider_id;

insert into public.chat_messages (
  chat_id,
  sender_user_id,
  message_type,
  payload,
  idempotency_key,
  created_at
)
select
  f.chat_id,
  f.client_id,
  'TEXT'::public.cns_message_type,
  jsonb_build_object('text', 'Inbound from client'),
  'f1700001-0001-4001-8001-000000000001'::uuid,
  now() - interval '2 minutes'
from _unread_fixture f;

select pg_temp.cns_set_auth((select provider_id from _unread_fixture));

select ok(
  public.cns_chat_is_unread_for_user(
    (select chat_id from _unread_fixture),
    (select provider_id from _unread_fixture)
  ),
  'provider sees unread after client inbound message'
);

select ok(
  (
    select (public.project_service_row(
      (select service_request_id from _unread_fixture),
      (select provider_id from _unread_fixture)
    )->'negotiation'->'chat'->>'is_unread')::boolean
  ),
  'project_service_row reflects unread inbound for provider'
);

select public.cns_mark_conversation_read(
  (select chat_id from _unread_fixture),
  (
    select m.id
    from public.chat_messages m
    where m.chat_id = (select chat_id from _unread_fixture)
      and m.idempotency_key = 'f1700001-0001-4001-8001-000000000001'::uuid
  )
);

select ok(
  not public.cns_chat_is_unread_for_user(
    (select chat_id from _unread_fixture),
    (select provider_id from _unread_fixture)
  ),
  'provider unread clears after mark_conversation_read on inbound message'
);

insert into public.chat_messages (
  chat_id,
  sender_user_id,
  message_type,
  payload,
  idempotency_key,
  created_at
)
select
  f.chat_id,
  f.provider_id,
  'TEXT'::public.cns_message_type,
  jsonb_build_object('text', 'Outbound from provider'),
  'f1700002-0002-4002-8002-000000000002'::uuid,
  now()
from _unread_fixture f;

select ok(
  not public.cns_chat_is_unread_for_user(
    (select chat_id from _unread_fixture),
    (select provider_id from _unread_fixture)
  ),
  'provider own outbound message does not mark chat unread'
);

insert into public.chat_messages (
  chat_id,
  sender_user_id,
  message_type,
  payload,
  idempotency_key,
  created_at
)
select
  f.chat_id,
  f.client_id,
  'TEXT'::public.cns_message_type,
  jsonb_build_object('text', 'Second inbound from client'),
  'f1700003-0003-4003-8003-000000000003'::uuid,
  now()
from _unread_fixture f;

select ok(
  public.cns_chat_is_unread_for_user(
    (select chat_id from _unread_fixture),
    (select provider_id from _unread_fixture)
  ),
  'new client inbound after provider reply marks chat unread again'
);

select pg_temp.cns_set_auth((select client_id from _unread_fixture));

select public.cns_mark_conversation_read(
  (select chat_id from _unread_fixture),
  (
    select m.id
    from public.chat_messages m
    where m.chat_id = (select chat_id from _unread_fixture)
      and m.idempotency_key = 'f1700002-0002-4002-8002-000000000002'::uuid
  )
);

select ok(
  not public.cns_chat_is_unread_for_user(
    (select chat_id from _unread_fixture),
    (select client_id from _unread_fixture)
  ),
  'client unread clears after reading provider outbound message'
);

insert into public.chat_messages (
  chat_id,
  sender_user_id,
  message_type,
  payload,
  idempotency_key,
  created_at
)
select
  f.chat_id,
  f.client_id,
  'TEXT'::public.cns_message_type,
  jsonb_build_object('text', 'Client follow-up'),
  'f1700004-0004-4004-8004-000000000004'::uuid,
  now()
from _unread_fixture f;

select ok(
  not public.cns_chat_is_unread_for_user(
    (select chat_id from _unread_fixture),
    (select client_id from _unread_fixture)
  ),
  'client own outbound message does not mark chat unread'
);

select * from finish();

rollback;
