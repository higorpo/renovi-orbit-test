-- pgTAP: cns_janitor_orphan_media (design §5.2, task 49, R26-AC02).

begin;

\ir fixtures/seed_chat.inc

select plan(6);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_janitor_orphan_media'
  ),
  'cns_janitor_orphan_media is SECURITY DEFINER'
);

select ok(
  has_function_privilege('service_role', 'public.cns_janitor_orphan_media(int)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.cns_janitor_orphan_media(int)', 'EXECUTE'),
  'service_role only may execute cns_janitor_orphan_media'
);

create temp table _orphan_media_fixture as
select
  pg_temp.cns_seed_chat(
    p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ) as chat_id,
  gen_random_uuid() as orphan_session_id,
  gen_random_uuid() as recent_session_id;

insert into public.chat_media_upload_sessions (
  id,
  chat_id,
  uploader_id,
  status,
  expires_at
)
select
  f.orphan_session_id,
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'pending',
  now() - interval '25 hours'
from _orphan_media_fixture f;

insert into public.chat_media_upload_sessions (
  id,
  chat_id,
  uploader_id,
  status,
  expires_at
)
select
  f.recent_session_id,
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'pending',
  now() - interval '1 hour'
from _orphan_media_fixture f;

insert into storage.objects (
  bucket_id,
  name,
  owner,
  metadata
)
select
  'chat-media',
  f.chat_id::text || '/' || f.orphan_session_id::text || '/photo.jpg',
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  jsonb_build_object('size', 2048)
from _orphan_media_fixture f;

insert into storage.objects (
  bucket_id,
  name,
  owner,
  metadata
)
select
  'chat-media',
  f.chat_id::text || '/' || f.recent_session_id::text || '/photo.jpg',
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  jsonb_build_object('size', 1024)
from _orphan_media_fixture f;

select is(
  (public.cns_janitor_orphan_media(500)->>'expired_count')::int,
  1,
  'expires one orphan session past retention window'
);

select is(
  (
    select s.status
    from public.chat_media_upload_sessions s
    join _orphan_media_fixture f on s.id = f.orphan_session_id
  ),
  'expired',
  'orphan session marked expired'
);

select ok(
  not exists (
    select 1
    from storage.objects o
    join _orphan_media_fixture f
      on o.name = f.chat_id::text || '/' || f.orphan_session_id::text || '/photo.jpg'
    where o.bucket_id = 'chat-media'
  ),
  'orphan storage objects deleted'
);

select ok(
  (
    select s.status
    from public.chat_media_upload_sessions s
    join _orphan_media_fixture f on s.id = f.recent_session_id
  ) = 'pending'
  and exists (
    select 1
    from storage.objects o
    join _orphan_media_fixture f
      on o.name = f.chat_id::text || '/' || f.recent_session_id::text || '/photo.jpg'
    where o.bucket_id = 'chat-media'
  ),
  'recent pending session and storage left untouched'
);

select finish();

rollback;
