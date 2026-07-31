-- pgTAP: payment_cron_sync_netcred_settlements wrapper + cron registration.

begin;

select plan(7);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_begin'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_sync_netcred_settlements'
  ),
  'payment_cron_sync_netcred_settlements records job_runs telemetry'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_cron_invoke_edge_function'
      and pg_get_functiondef(p.oid) ~* 'sync-netcred-settlements'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_sync_netcred_settlements'
  ),
  'delegates to payment_cron_invoke_edge_function(sync-netcred-settlements)'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_abort_latest'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_sync_netcred_settlements'
  ),
  'aborts stale job_runs on wrapper failure'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_sync_netcred_settlements'
  ),
  'payment_cron_sync_netcred_settlements is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.payment_cron_sync_netcred_settlements()'::regprocedure,
    'EXECUTE'
  ),
  'postgres can execute payment_cron_sync_netcred_settlements'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_cron_sync_netcred_settlements()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute payment_cron_sync_netcred_settlements'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'sync-netcred-settlements'
      and j.schedule = '15,45 * * * *'
      and j.command like '%payment_cron_sync_netcred_settlements%'
      and j.active = true
  ),
  'sync-netcred-settlements cron is registered and active'
);

select * from finish();

rollback;
