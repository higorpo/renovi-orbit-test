-- pgTAP: cns_refresh_media_signed_urls (design §5.1, task 56, R31-AC06).

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

create temp table _refresh_urls_fixture as
select
  pg_temp.cns_seed_chat(
    p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ) as chat_id,
  gen_random_uuid() as message_id,
  gen_random_uuid() as session_id;

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
from _refresh_urls_fixture f;

insert into public.chat_messages (
  id,
  chat_id,
  sender_user_id,
  message_type,
  payload,
  idempotency_key
)
select
  f.message_id,
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'IMAGE'::public.cns_message_type,
  jsonb_build_object(
    'upload_session_id', f.session_id,
    'paths', jsonb_build_array(
      f.chat_id::text || '/' || f.session_id::text || '/photo.jpg'
    )
  ),
  gen_random_uuid()
from _refresh_urls_fixture f;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select ok(
  (
    select public.cns_refresh_media_signed_urls(
      array[(select message_id from _refresh_urls_fixture)],
      null,
      3600
    )->>'bucket'
  ) = 'chat-media',
  'returns chat-media bucket'
);

select is(
  jsonb_array_length(
    public.cns_refresh_media_signed_urls(
      array[(select message_id from _refresh_urls_fixture)],
      null,
      3600
    )->'paths'
  ),
  1,
  'returns one authorized path from message id'
);

select ok(
  (
    select public.cns_refresh_media_signed_urls(
      null,
      array[
        (
          select chat_id::text || '/' || session_id::text || '/photo.jpg'
          from _refresh_urls_fixture
        )
      ],
      3600
    )->'expires_in'
  )::int between 60 and 86400,
  'returns clamped expires_in for direct paths'
);

select pg_temp.cns_set_auth('c9999999-9999-4999-8999-999999999999'::uuid);

select throws_ok(
  $sql$
    select public.cns_refresh_media_signed_urls(
      array[(select message_id from _refresh_urls_fixture)],
      null
    );
  $sql$,
  '42501',
  'No authorized media paths found',
  'non-participant cannot refresh message media paths'
);

select throws_ok(
  $sql$
    select public.cns_refresh_media_signed_urls(
      null,
      array['00000000-0000-4000-8000-000000000099/00000000-0000-4000-8000-000000000099/x.jpg']
    );
  $sql$,
  '42501',
  'NOT_A_PARTICIPANT',
  'rejects foreign chat path prefix'
);

select finish();

rollback;
