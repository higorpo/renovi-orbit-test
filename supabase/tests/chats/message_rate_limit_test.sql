-- pgTAP: cns_check_message_rate_limit (design §3.14, §4.2, Req. 3, R3-AC11).

begin;

\ir fixtures/seed_chat.inc

select plan(9);

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
      and p.proname = 'cns_check_message_rate_limit'
  ),
  'cns_check_message_rate_limit is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.cns_check_message_rate_limit(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cns_check_message_rate_limit(uuid)',
    'EXECUTE'
  ),
  'service_role only may execute cns_check_message_rate_limit directly'
);

create temp table _rate_limit_fixture as
select
  pg_temp.cns_seed_chat(
    p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ) as chat_id;

select throws_ok(
  $sql$
    select public.cns_check_message_rate_limit(
      (select chat_id from _rate_limit_fixture)
    );
  $sql$,
  '42501',
  null,
  'unauthenticated caller is rejected'
);

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select lives_ok(
  $sql$
    select public.cns_check_message_rate_limit(
      (select chat_id from _rate_limit_fixture)
    );
  $sql$,
  'participant may pass rate limit check'
);

select is(
  (
    select message_count
    from public.chat_rate_limit_buckets
    where chat_id = (select chat_id from _rate_limit_fixture)
      and user_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      and window_started_at = date_trunc('minute', clock_timestamp())
  ),
  1,
  'first check inserts a minute bucket with count 1'
);

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select throws_ok(
  $sql$
    select public.cns_check_message_rate_limit(
      '00000000-0000-4000-8000-000000000001'::uuid
    );
  $sql$,
  '42501',
  null,
  'non-participant is rejected'
);

update public.platform_constants
set value = '2'::jsonb
where key = 'chats.message_rate_limit_per_minute';

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select lives_ok(
  $sql$
    select public.cns_check_message_rate_limit(
      (select chat_id from _rate_limit_fixture)
    );
  $sql$,
  'second message within limit succeeds when limit is 2'
);

select throws_ok(
  $sql$
    select public.cns_check_message_rate_limit(
      (select chat_id from _rate_limit_fixture)
    );
  $sql$,
  'P0001',
  'RATE_LIMITED',
  'third message in same minute raises RATE_LIMITED when limit is 2'
);

create or replace function pg_temp.cns_rate_limit_detail_has_retry(p_chat_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_detail text;
begin
  perform public.cns_check_message_rate_limit(p_chat_id);
  return false;
exception
  when others then
    get stacked diagnostics v_detail = pg_exception_detail;
    return sqlerrm = 'RATE_LIMITED' and v_detail like '%retry_after_seconds%';
end;
$$;

select ok(
  pg_temp.cns_rate_limit_detail_has_retry((select chat_id from _rate_limit_fixture)),
  'RATE_LIMITED detail includes retry_after_seconds'
);

select finish();

rollback;
