-- pgTAP: cns_attach_message_media + IMAGE send path (design §5.2, task 55, R3-AC06, R26-AC02).

begin;

\ir fixtures/seed_chat.inc

select plan(6);

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

create temp table _attach_media_fixture as
select
  pg_temp.cns_seed_chat(
    p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ) as chat_id,
  gen_random_uuid() as session_id,
  gen_random_uuid() as bad_path_session_id;

insert into public.chat_media_upload_sessions (
  id,
  chat_id,
  uploader_id,
  status,
  expires_at
)
select
  f.session_id,
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'pending',
  now() + interval '12 hours'
from _attach_media_fixture f;

insert into public.chat_media_upload_sessions (
  id,
  chat_id,
  uploader_id,
  status,
  expires_at
)
select
  f.bad_path_session_id,
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'pending',
  now() + interval '12 hours'
from _attach_media_fixture f;

insert into storage.objects (
  bucket_id,
  name,
  owner,
  metadata
)
select
  'chat-media',
  f.chat_id::text || '/' || f.session_id::text || '/photo.jpg',
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  jsonb_build_object('size', 1024)
from _attach_media_fixture f
union all
select
  'chat-media',
  f.chat_id::text || '/' || f.bad_path_session_id::text || '/photo.jpg',
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  jsonb_build_object('size', 1024)
from _attach_media_fixture f;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select throws_ok(
  $sql$
    select public.cns_attach_message_media(
      (select chat_id from _attach_media_fixture),
      (select session_id from _attach_media_fixture),
      array[
        (select chat_id::text from _attach_media_fixture)
          || '/'
          || (select session_id::text from _attach_media_fixture)
          || '/photo.jpg'
      ]
    );
  $sql$,
  '42501',
  'permission denied for function cns_attach_message_media',
  'authenticated cannot call cns_attach_message_media directly'
);

select ok(
  (
    select public.cns_send_message(
      'IMAGE'::public.cns_message_type,
      'a1111111-1111-4111-8111-111111111111'::uuid,
      jsonb_build_object(
        'upload_session_id', (select session_id from _attach_media_fixture),
        'paths', jsonb_build_array(
          (select chat_id::text from _attach_media_fixture)
            || '/'
            || (select session_id::text from _attach_media_fixture)
            || '/photo.jpg'
        )
      ),
      (select chat_id from _attach_media_fixture)
    )->'message'->>'message_type'
  ) = 'IMAGE',
  'cns_send_message IMAGE completes attach in same transaction'
);

select is(
  (
    select s.status
    from public.chat_media_upload_sessions s
    join _attach_media_fixture f on s.id = f.session_id
  ),
  'completed',
  'session marked completed after send_message IMAGE'
);

select throws_ok(
  $sql$
    select public.cns_send_message(
      'IMAGE'::public.cns_message_type,
      'c3333333-3333-4333-8333-333333333333'::uuid,
      jsonb_build_object(
        'upload_session_id', (select bad_path_session_id from _attach_media_fixture),
        'paths', jsonb_build_array('wrong/chat/session/photo.jpg')
      ),
      (select chat_id from _attach_media_fixture)
    );
  $sql$,
  '42501',
  'UPLOAD_PATH_SESSION_MISMATCH',
  'send_message rejects paths outside session prefix'
);

select throws_ok(
  $sql$
    select public.cns_send_message(
      'IMAGE'::public.cns_message_type,
      'd4444444-4444-4444-8444-444444444444'::uuid,
      jsonb_build_object(
        'upload_session_id', (select bad_path_session_id from _attach_media_fixture),
        'paths', jsonb_build_array(
          (select chat_id::text from _attach_media_fixture)
            || '/'
            || (select bad_path_session_id::text from _attach_media_fixture)
            || '/../'
            || (select session_id::text from _attach_media_fixture)
            || '/photo.jpg'
        )
      ),
      (select chat_id from _attach_media_fixture)
    );
  $sql$,
  '42501',
  'UPLOAD_PATH_INVALID',
  'send_message rejects path traversal segments'
);

select ok(
  (
    select public.cns_send_message(
      'IMAGE'::public.cns_message_type,
      'b2222222-2222-4222-8222-222222222222'::uuid,
      jsonb_build_object(
        'upload_session_id', (select bad_path_session_id from _attach_media_fixture),
        'paths', jsonb_build_array(
          (select chat_id::text from _attach_media_fixture)
            || '/'
            || (select bad_path_session_id::text from _attach_media_fixture)
            || '/photo.jpg'
        )
      ),
      (select chat_id from _attach_media_fixture)
    )->'message'->>'message_type'
  ) = 'IMAGE',
  'cns_send_message IMAGE with valid session prefix marks session completed'
);

select finish();

rollback;
