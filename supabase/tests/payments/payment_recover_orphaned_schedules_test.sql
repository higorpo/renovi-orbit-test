-- pgTAP: payment Task 32 — payment_recover_orphaned_schedules RPC.

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
  $$ select * from public.payment_recover_orphaned_schedules() $$,
  '42501',
  'service_role required for payment_recover_orphaned_schedules',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select is(
  (select recovered_count from public.payment_recover_orphaned_schedules()),
  0,
  'returns zero recovered_count on clean system'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_recover_orphaned_schedules'
  ),
  'payment_recover_orphaned_schedules is SECURITY DEFINER'
);

select finish();

rollback;
