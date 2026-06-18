-- pgTAP: client project_service_row chat summary prefers unread over latest interaction.

begin;

\ir ../rls/fixtures/seed_rls_actors.inc
\ir ../chats/fixtures/seed_chat.inc

select plan(2);

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

create temp table _fixture as
select
  '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid as service_request_id,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid as client_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid as read_chat_provider_id,
  'a1b2c3d4-e5f6-4789-a012-3456789abcde'::uuid as unread_chat_provider_id,
  pg_temp.cns_seed_chat(
    '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'ACTIVE'::public.cns_conversation_status,
    now()
  ) as read_chat_id,
  null::uuid as unread_chat_id;

select pg_temp.rls_seed_user(
  'a1b2c3d4-e5f6-4789-a012-3456789abcde'::uuid,
  'provider',
  'Maria Pintora'
);

insert into public.provider_profiles_public (provider_id, display_name, slug, profile_visibility)
select f.unread_chat_provider_id, 'Maria Pintora', 'maria-pintora-unread-summary', 'public'
from _fixture f
on conflict (provider_id) do update
  set display_name = excluded.display_name;

update _fixture f
set unread_chat_id = pg_temp.cns_seed_chat(
  f.service_request_id,
  f.client_id,
  f.unread_chat_provider_id,
  'ACTIVE'::public.cns_conversation_status,
  now() - interval '2 hours'
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
  f.read_chat_id,
  f.read_chat_provider_id,
  'TEXT'::public.cns_message_type,
  jsonb_build_object('text', 'Read provider reply'),
  'f2100001-0001-4001-8001-000000000001'::uuid,
  now() - interval '30 minutes'
from _fixture f
union all
select
  f.read_chat_id,
  f.client_id,
  'TEXT'::public.cns_message_type,
  jsonb_build_object('text', 'Client follow-up'),
  'f2100001-0001-4001-8001-000000000002'::uuid,
  now()
from _fixture f
union all
select
  f.unread_chat_id,
  f.unread_chat_provider_id,
  'TEXT'::public.cns_message_type,
  jsonb_build_object('text', 'Unread provider message'),
  'f2100001-0001-4001-8001-000000000003'::uuid,
  now() - interval '1 hour'
from _fixture f;

update public.chats c
set last_interaction_at = now()
from _fixture f
where c.id = f.read_chat_id;

update public.chats c
set last_interaction_at = now() - interval '1 hour'
from _fixture f
where c.id = f.unread_chat_id;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.cns_mark_conversation_read(
  f.read_chat_id,
  (
    select m.id
    from public.chat_messages m
    where m.chat_id = f.read_chat_id
      and m.idempotency_key = 'f2100001-0001-4001-8001-000000000002'::uuid
  )
)
from _fixture f;

select is(
  (
    select public.project_service_row(
      f.service_request_id,
      f.client_id
    )->'negotiation'->'chat'->>'id'
    from _fixture f
  ),
  (select unread_chat_id::text from _fixture),
  'client chat summary prefers unread chat over more recently active read chat'
);

select is(
  (
    select public.project_service_row(
      f.service_request_id,
      f.client_id
    )->'negotiation'->'chat'->>'provider_display_name'
    from _fixture f
  ),
  'Maria Pintora',
  'client chat summary exposes unread chat provider display name'
);

select * from finish();
rollback;
