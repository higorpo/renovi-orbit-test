-- pgTAP: cns_validate_upload_session (design §5.2, task 53, R3-AC06).

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

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_validate_upload_session'
  ),
  'cns_validate_upload_session is SECURITY DEFINER'
);

create temp table _upload_session_fixture as
select
  pg_temp.cns_seed_chat(
    p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ) as chat_id,
  gen_random_uuid() as valid_session_id,
  gen_random_uuid() as expired_session_id,
  gen_random_uuid() as completed_session_id;

insert into public.chat_media_upload_sessions (
  id,
  chat_id,
  uploader_id,
  status,
  expires_at
)
select
  f.valid_session_id,
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'pending',
  now() + interval '12 hours'
from _upload_session_fixture f;

insert into public.chat_media_upload_sessions (
  id,
  chat_id,
  uploader_id,
  status,
  expires_at
)
select
  f.expired_session_id,
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'pending',
  now() - interval '1 hour'
from _upload_session_fixture f;

insert into public.chat_media_upload_sessions (
  id,
  chat_id,
  uploader_id,
  status,
  expires_at
)
select
  f.completed_session_id,
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'completed',
  now() + interval '12 hours'
from _upload_session_fixture f;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select ok(
  (
    select public.cns_validate_upload_session(
      (select valid_session_id from _upload_session_fixture),
      (select chat_id from _upload_session_fixture)
    )->>'upload_session_id'
  ) = (select valid_session_id::text from _upload_session_fixture),
  'valid pending session returns upload_session_id'
);

select ok(
  (
    select public.cns_validate_upload_session(
      (select valid_session_id from _upload_session_fixture),
      (select chat_id from _upload_session_fixture)
    )->>'storage_path_prefix'
  ) like '%/',
  'returns storage_path_prefix for Edge upload'
);

select throws_ok(
  $sql$
    select public.cns_validate_upload_session(
      (select expired_session_id from _upload_session_fixture),
      (select chat_id from _upload_session_fixture)
    );
  $sql$,
  '42501',
  'UPLOAD_SESSION_EXPIRED',
  'rejects expired session'
);

select throws_ok(
  $sql$
    select public.cns_validate_upload_session(
      (select completed_session_id from _upload_session_fixture),
      (select chat_id from _upload_session_fixture)
    );
  $sql$,
  '42501',
  'UPLOAD_SESSION_NOT_PENDING',
  'rejects non-pending session'
);

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select throws_ok(
  $sql$
    select public.cns_validate_upload_session(
      (select valid_session_id from _upload_session_fixture),
      (select chat_id from _upload_session_fixture)
    );
  $sql$,
  '42501',
  'UPLOAD_SESSION_UPLOADER_MISMATCH',
  'rejects non-uploader participant'
);

select finish();

rollback;
