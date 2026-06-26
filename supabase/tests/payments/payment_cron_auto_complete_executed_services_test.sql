-- pgTAP: payment Task 54 — payment_cron_auto_complete_executed_services wrapper grants and shape.

begin;

select plan(5);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_begin'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_auto_complete_executed_services'
  ),
  'payment_cron_auto_complete_executed_services records job_runs telemetry'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_auto_complete_executed_services'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_auto_complete_executed_services'
  ),
  'delegates to payment_auto_complete_executed_services batch RPC'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_abort_latest'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_auto_complete_executed_services'
  ),
  'aborts stale job_runs on wrapper failure'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.payment_cron_auto_complete_executed_services()'::regprocedure,
    'EXECUTE'
  ),
  'postgres can execute payment_cron_auto_complete_executed_services'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_cron_auto_complete_executed_services()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute payment_cron_auto_complete_executed_services'
);

select * from finish();
rollback;
