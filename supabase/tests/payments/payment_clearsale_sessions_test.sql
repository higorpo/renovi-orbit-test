-- pgTAP: ClearSale server-bound sessions (CHK-011, CHK-013).

begin;

select plan(5);

create or replace function pg_temp.payment_set_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
end;
$$;

select throws_ok(
  $$ select public.payment_begin_manual_attempt(
    gen_random_uuid(),
    gen_random_uuid(),
    'not-a-uuid'
  ) $$,
  '42501',
  'service_role required for payment_begin_manual_attempt',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_begin_manual_attempt(
    gen_random_uuid(),
    gen_random_uuid(),
    'not-a-uuid'
  ) $$,
  'P0001',
  'CLEARSALE_SESSION_INVALID',
  'rejects non-UUID clearsale_session_id'
);

select throws_ok(
  $$ select public.payment_consume_clearsale_session(
    gen_random_uuid()::text,
    gen_random_uuid(),
    'accept',
    gen_random_uuid(),
    null
  ) $$,
  'P0001',
  'CLEARSALE_SESSION_INVALID',
  'rejects orphan forged ClearSale UUID'
);

select throws_ok(
  $$ select public.payment_issue_clearsale_session('accept', gen_random_uuid(), null) $$,
  '42501',
  'Authentication required for payment_issue_clearsale_session',
  'issue requires authenticated actor'
);

select throws_ok(
  $$ select public.payment_begin_manual_attempt(
    gen_random_uuid(),
    gen_random_uuid(),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) $$,
  'P0002',
  'SCHEDULE_NOT_FOUND',
  'UUID-format session still requires an existing schedule'
);

select * from finish();

rollback;
