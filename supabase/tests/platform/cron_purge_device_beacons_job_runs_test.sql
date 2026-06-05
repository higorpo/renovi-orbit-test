-- pgTAP: cron_purge_stale_user_device_beacons job_runs wrapper.

begin;

select plan(5);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cron_purge_stale_user_device_beacons'
  ),
  'cron_purge_stale_user_device_beacons is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.cron_purge_stale_user_device_beacons()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cron_purge_stale_user_device_beacons()',
    'EXECUTE'
  ),
  'postgres only may execute purge device beacons cron wrapper'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'purge_stale_user_device_beacons'
      and j.schedule = '0 3 * * *'
      and j.command like '%cron_purge_stale_user_device_beacons%'
  ),
  'purge_stale_user_device_beacons cron calls wrapper'
);

select ok(
  (
    select (public.cron_purge_stale_user_device_beacons()->>'job_run_id') is not null
  ),
  'wrapper returns job_run_id'
);

select ok(
  exists (
    select 1
    from public.job_runs jr
    where jr.job_name = 'purge_stale_user_device_beacons'
      and jr.finished_at is not null
  ),
  'wrapper records finished job_runs row'
);

select finish();

rollback;
