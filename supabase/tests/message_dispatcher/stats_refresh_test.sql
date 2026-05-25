-- pgTAP: message_dispatcher_stats + mmd_refresh_stats cron (design §10.2, task 83).

begin;

select plan(6);

select ok(
  exists (
    select 1
    from pg_tables t
    where t.schemaname = 'message_dispatcher'
      and t.tablename = 'message_dispatcher_stats'
  ),
  'message_dispatcher_stats table exists'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'message_dispatcher'
      and p.proname = 'message_dispatcher_refresh_stats'
  ),
  'message_dispatcher_refresh_stats function exists'
);

select lives_ok(
  $$select message_dispatcher.message_dispatcher_refresh_stats()$$,
  'refresh_stats runs without error'
);

select ok(
  (select count(*) >= 2
   from message_dispatcher.message_dispatcher_stats
   where metric_name in ('mmd_queue_lag', 'mmd_retryable_failures')),
  'refresh_stats populates core gauge rows'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'mmd_refresh_stats'
      and j.schedule = '*/5 * * * *'
      and j.command like '%message_dispatcher_refresh_stats%'
  ),
  'mmd_refresh_stats cron job exists'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'mmd_refresh_stats'
      and j.active = true
  ),
  'mmd_refresh_stats cron job is active'
);

select finish();

rollback;
