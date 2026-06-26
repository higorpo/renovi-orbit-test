-- pgTAP: payment Task 55 — payment_cron_process_webhook_retry wrapper grants and shape.

begin;

select plan(7);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_begin'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_process_webhook_retry'
  ),
  'payment_cron_process_webhook_retry records job_runs telemetry'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_claim_webhook_processing_batch'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_process_webhook_retry'
  ),
  'claims PENDING webhook processing queue rows'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_claim_webhook_retry_batch'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_process_webhook_retry'
  ),
  'claims FAILED webhook events for retry'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_process_webhook_event'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_process_webhook_retry'
  ),
  'processes claimed webhook events'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_abort_latest'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_process_webhook_retry'
  ),
  'aborts stale job_runs on wrapper failure'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.payment_cron_process_webhook_retry()'::regprocedure,
    'EXECUTE'
  ),
  'postgres can execute payment_cron_process_webhook_retry'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_cron_process_webhook_retry()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute payment_cron_process_webhook_retry'
);

select * from finish();
rollback;
