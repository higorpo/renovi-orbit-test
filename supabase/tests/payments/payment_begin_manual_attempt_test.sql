-- pgTAP: payment Task 30 — payment_begin_manual_attempt RPC.

begin;

select plan(3);

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
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
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
  'rejects non-UUID clearsale session'
);

select throws_ok(
  $$ select public.payment_begin_manual_attempt(
    gen_random_uuid(),
    gen_random_uuid(),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) $$,
  'P0002',
  'SCHEDULE_NOT_FOUND',
  'rejects missing schedule'
);

select finish();

rollback;
