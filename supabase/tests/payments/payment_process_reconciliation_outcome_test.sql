-- pgTAP: payment Task 40 — payment_process_reconciliation_outcome RPC.

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
  $$ select public.payment_process_reconciliation_outcome(
    gen_random_uuid(),
    'PAID'
  ) $$,
  '42501',
  'service_role required for payment_process_reconciliation_outcome',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select is(
  public.payment_process_reconciliation_outcome(
    gen_random_uuid(),
    'PAID'
  )->>'reason',
  'schedule_not_reconcilable',
  'returns schedule_not_reconcilable for missing schedule'
);

select is(
  (
    public.payment_process_reconciliation_outcome(
      gen_random_uuid(),
      null
    )->>'reason'
  ),
  'schedule_not_reconcilable',
  'missing gateway state on missing schedule stays not reconcilable'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_process_reconciliation_outcome'
  ),
  'payment_process_reconciliation_outcome is SECURITY DEFINER'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'CHARGE_IN_ANALYSIS'
      and pg_get_functiondef(p.oid) ~* 'payment_enqueue_notifications'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_process_reconciliation_outcome'
  ),
  'IN_ANALYSIS reconciliation path enqueues CHARGE_IN_ANALYSIS notification'
);

select finish();

rollback;
