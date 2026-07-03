-- pgTAP: Phase 2 GA prerequisites (design §13.1, §8.5, task 120).

begin;

select plan(5);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'message_dispatcher'
      and p.proname = 'message_dispatcher_invoke_worker'
  ),
  'invoke_worker RPC exists for phase 2 cron'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'message_dispatcher'
      and p.proname = 'message_dispatcher_evaluate_alerts'
  ),
  'evaluate_alerts exists for phase 2 monitoring'
);

select ok(
  (
    select count(*) >= 4
    from pg_views v
    where v.schemaname = 'message_dispatcher'
      and v.viewname in (
        'alert_queue_lag_v',
        'alert_terminal_spike_v',
        'alert_janitor_churn_v',
        'alert_retryable_depth_v'
      )
  ),
  'alert views for GA monitoring are present'
);

select ok(
  exists (
    select 1
    from vault.decrypted_secrets
    where name = 'orbit_supabase_url'
  )
  and exists (
    select 1
    from vault.decrypted_secrets
    where name = 'orbit_cron_secret'
  ),
  'orbit_supabase_url and orbit_cron_secret vault secrets exist'
);

select ok(
  exists (
    select 1
    from public.platform_constants pc
    where pc.key = 'message_dispatcher.max_parallel_workers'
      and (pc.value #>> '{}')::integer between 1 and 5
  ),
  'max_parallel_workers platform_constant exists and is between 1 and 5'
);

select finish();

rollback;
