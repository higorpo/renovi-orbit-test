-- pgTAP: payment Task 56 — payment_cron_recover_orphaned_schedules wrapper grants and shape.

begin;

select plan(5);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_begin'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_recover_orphaned_schedules'
  ),
  'payment_cron_recover_orphaned_schedules records job_runs telemetry'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_recover_orphaned_schedules'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_recover_orphaned_schedules'
  ),
  'delegates to payment_recover_orphaned_schedules batch RPC'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_abort_latest'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_recover_orphaned_schedules'
  ),
  'aborts stale job_runs on wrapper failure'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.payment_cron_recover_orphaned_schedules()'::regprocedure,
    'EXECUTE'
  ),
  'postgres can execute payment_cron_recover_orphaned_schedules'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_cron_recover_orphaned_schedules()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute payment_cron_recover_orphaned_schedules'
);

select * from finish();
rollback;
