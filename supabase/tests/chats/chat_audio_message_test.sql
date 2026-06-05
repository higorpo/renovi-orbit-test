-- pgTAP: AUDIO message type, preview text, and cns_send_message validation.

begin;

\ir fixtures/seed_chat.inc

select plan(5);

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

select is(
  public.cns_message_preview_text(
    'AUDIO'::public.cns_message_type,
    '{}'::jsonb
  ),
  '🎤 Áudio',
  'AUDIO preview text is microphone emoji label'
);

create temp table _audio_fixture as
select
  pg_temp.cns_seed_chat(
    p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ) as chat_id,
  gen_random_uuid() as session_id;

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
from _audio_fixture f;

insert into storage.objects (
  bucket_id,
  name,
  owner,
  metadata
)
select
  'chat-media',
  f.chat_id::text || '/' || f.session_id::text || '/audio.webm',
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  jsonb_build_object('size', 4096)
from _audio_fixture f;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select throws_ok(
  $sql$
    select public.cns_send_message(
      'AUDIO'::public.cns_message_type,
      gen_random_uuid(),
      jsonb_build_object(
        'upload_session_id', (select session_id::text from _audio_fixture),
        'path', (select chat_id::text from _audio_fixture) || '/' || (select session_id::text from _audio_fixture) || '/audio.webm',
        'duration_ms', 200000,
        'mime_type', 'audio/webm'
      ),
      (select chat_id from _audio_fixture),
      null
    );
  $sql$,
  '22023',
  'AUDIO duration_ms must be between 1 and 120000',
  'rejects audio duration over 2 minutes'
);

select throws_ok(
  $sql$
    select public.cns_send_message(
      'AUDIO'::public.cns_message_type,
      gen_random_uuid(),
      jsonb_build_object(
        'upload_session_id', (select session_id::text from _audio_fixture),
        'duration_ms', 5000,
        'mime_type', 'audio/webm'
      ),
      (select chat_id from _audio_fixture),
      null
    );
  $sql$,
  '22023',
  'path required for AUDIO messages',
  'rejects audio without path'
);

create temp table _audio_send as
select public.cns_send_message(
  'AUDIO'::public.cns_message_type,
  'b2222222-2222-4222-8222-222222222222'::uuid,
  jsonb_build_object(
    'upload_session_id', (select session_id::text from _audio_fixture),
    'path', (select chat_id::text from _audio_fixture) || '/' || (select session_id::text from _audio_fixture) || '/audio.webm',
    'duration_ms', 45000,
    'mime_type', 'audio/webm;codecs=opus',
    'preview', 'Áudio'
  ),
  (select chat_id from _audio_fixture),
  null
) as result;

select is(
  (select result->'message'->>'message_type' from _audio_send),
  'AUDIO',
  'successful AUDIO send returns message_type AUDIO'
);

select is(
  (
    select s.status
    from public.chat_media_upload_sessions s
    where s.id = (select session_id from _audio_fixture)
  ),
  'completed',
  'upload session marked completed after AUDIO attach'
);

select * from finish();
rollback;
