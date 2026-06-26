-- pgTAP: payment Task 29 — payment_commit_charge_outcome RPC.

begin;

select plan(2);

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
  $$ select public.payment_commit_charge_outcome(
    gen_random_uuid(),
    'PAID',
    100.00
  ) $$,
  '42501',
  'service_role required for payment_commit_charge_outcome',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_commit_charge_outcome(
    gen_random_uuid(),
    'PAID',
    100.00
  ) $$,
  'P0001',
  'INVALID_SCHEDULE_STATE',
  'rejects when schedule is not PROCESSING'
);

select finish();

rollback;
