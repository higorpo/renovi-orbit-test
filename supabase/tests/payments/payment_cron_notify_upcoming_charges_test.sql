-- pgTAP: payment Task 53 — payment_cron_notify_upcoming_charges wrapper grants and shape.

begin;

select plan(6);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_begin'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_notify_upcoming_charges'
  ),
  'payment_cron_notify_upcoming_charges records job_runs telemetry'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_notify_upcoming_charges_batch'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_notify_upcoming_charges'
  ),
  'delegates to payment_notify_upcoming_charges_batch'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_enqueue_notifications'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_notify_upcoming_charges'
  ),
  'enqueues UPCOMING_CHARGE notifications after batch claim'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_abort_latest'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_notify_upcoming_charges'
  ),
  'aborts stale job_runs on wrapper failure'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.payment_cron_notify_upcoming_charges()'::regprocedure,
    'EXECUTE'
  ),
  'postgres can execute payment_cron_notify_upcoming_charges'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_cron_notify_upcoming_charges()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute payment_cron_notify_upcoming_charges'
);

select * from finish();
rollback;
