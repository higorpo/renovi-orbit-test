-- Instrument purge_stale_user_device_beacons with job_runs telemetry (platform cron pattern).

create or replace function public.cron_purge_stale_user_device_beacons()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_deleted bigint;
begin
  v_job_run_id := public.job_run_begin('purge_stale_user_device_beacons', 'v1');
  v_deleted := public.purge_stale_user_device_beacons();

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    coalesce(v_deleted, 0)::int,
    coalesce(v_deleted, 0)::int,
    0,
    jsonb_build_object('retention_days', 30)
  );

  return jsonb_build_object(
    'deleted_count', coalesce(v_deleted, 0),
    'job_run_id', v_job_run_id
  );
exception
  when others then
    perform public.job_run_abort_latest('purge_stale_user_device_beacons', sqlerrm);
    raise;
end;
$$;

comment on function public.cron_purge_stale_user_device_beacons() is
  'pg_cron entrypoint: purge stale user_device_beacons with job_runs telemetry.';

revoke all on function public.cron_purge_stale_user_device_beacons() from public;
revoke all on function public.cron_purge_stale_user_device_beacons() from authenticated;
revoke all on function public.cron_purge_stale_user_device_beacons() from anon;

grant execute on function public.cron_purge_stale_user_device_beacons() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'purge_stale_user_device_beacons';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'purge_stale_user_device_beacons',
  '0 3 * * *',
  $$select public.cron_purge_stale_user_device_beacons();$$
);
