-- pgTAP: payment Task 52 — payment_cron_auto_cancel_unpaid_services wrapper grants and shape.

begin;

select plan(6);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_begin'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_auto_cancel_unpaid_services'
  ),
  'payment_cron_auto_cancel_unpaid_services records job_runs telemetry'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_auto_cancel_services'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_auto_cancel_unpaid_services'
  ),
  'delegates to payment_auto_cancel_services batch RPC'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_abort_latest'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_auto_cancel_unpaid_services'
  ),
  'aborts stale job_runs on wrapper failure'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.payment_cron_auto_cancel_unpaid_services()'::regprocedure,
    'EXECUTE'
  ),
  'postgres can execute payment_cron_auto_cancel_unpaid_services'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_cron_auto_cancel_unpaid_services()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute payment_cron_auto_cancel_unpaid_services'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_enqueue_notifications'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_auto_cancel_unpaid_services'
  ),
  'enqueues SERVICE_AUTO_CANCELLED notifications after batch cancel'
);

select * from finish();
rollback;
