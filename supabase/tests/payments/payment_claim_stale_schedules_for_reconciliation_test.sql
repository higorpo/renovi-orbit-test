-- pgTAP: payment Task 39 — payment_claim_stale_schedules_for_reconciliation RPC.

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
  $$ select public.payment_claim_stale_schedules_for_reconciliation() $$,
  '42501',
  'service_role required for payment_claim_stale_schedules_for_reconciliation',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select is(
  public.payment_claim_stale_schedules_for_reconciliation(),
  '[]'::jsonb,
  'returns empty batch when no stale schedules exist'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_claim_stale_schedules_for_reconciliation'
  ),
  'payment_claim_stale_schedules_for_reconciliation is SECURITY DEFINER'
);

select finish();

rollback;
