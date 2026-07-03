-- pgTAP: payment Task 130 — payment_ops_job_health RPC.

begin;

select plan(4);

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
  $$ select public.payment_ops_job_health() $$,
  '42501',
  null,
  'payment_ops_job_health rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

do $seed$
begin
  insert into public.job_runs (
    job_name, started_at, finished_at, duration_ms,
    processed_count, error_count, metadata
  )
  values (
    'schedule-netcred-charges',
    now() - interval '2 hours',
    now() - interval '1 hour 59 minutes',
    1200,
    5,
    0,
    '{}'::jsonb
  );

  insert into public.job_runs (
    job_name, started_at, finished_at, duration_ms,
    processed_count, error_count, metadata
  )
  values (
    'process-webhook-retry',
    now() - interval '1 hour',
    now() - interval '59 minutes',
    800,
    10,
    2,
    jsonb_build_object('queue_drained', 8)
  );

  insert into public.job_runs (
    job_name, started_at, metadata
  )
  values (
    'reconcile-netcred-payments',
    now() - interval '45 minutes',
    '{}'::jsonb
  );

  insert into public.job_runs (
    job_name, started_at, finished_at, duration_ms,
    processed_count, error_count, metadata
  )
  values (
    'auto-cancel-unpaid-services',
    now() - interval '30 minutes',
    now() - interval '29 minutes',
    500,
    1,
    1,
    jsonb_build_object('fatal_error', 'connection timeout')
  );
end;
$seed$;

select ok(
  (public.payment_ops_job_health(24, 30)->'summary'->>'jobs_tracked')::int = 9,
  'tracks all nine payment cron job names'
);

select ok(
  (public.payment_ops_job_health(24, 30)->'summary'->>'stale_run_count')::int >= 1,
  'detects stale run with finished_at IS NULL'
);

select ok(
  (public.payment_ops_job_health(24, 30)->'summary'->>'fatal_run_count')::int >= 1,
  'detects metadata.fatal_error runs'
);

select finish();
rollback;
