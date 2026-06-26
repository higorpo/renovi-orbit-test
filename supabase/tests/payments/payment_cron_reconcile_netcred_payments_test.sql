-- pgTAP: payment Task 58 — payment_cron_reconcile_netcred_payments wrapper grants and shape.

begin;

select plan(5);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_begin'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_reconcile_netcred_payments'
  ),
  'payment_cron_reconcile_netcred_payments records job_runs telemetry'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_cron_invoke_edge_function'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_reconcile_netcred_payments'
  ),
  'delegates to payment_cron_invoke_edge_function'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_abort_latest'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_reconcile_netcred_payments'
  ),
  'aborts stale job_runs on wrapper failure'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.payment_cron_reconcile_netcred_payments()'::regprocedure,
    'EXECUTE'
  ),
  'postgres can execute payment_cron_reconcile_netcred_payments'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_cron_reconcile_netcred_payments()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute payment_cron_reconcile_netcred_payments'
);

select * from finish();
rollback;
