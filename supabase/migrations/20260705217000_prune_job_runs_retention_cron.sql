-- Platform maintenance — prune job_runs older than retention window (default 90 days).

create or replace function public.cns_prune_job_runs(
  p_retention_days int default 90,
  p_batch_limit int default 10000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_retention interval;
  v_deleted_count int := 0;
  v_duration_ms int;
begin
  if p_retention_days is null or p_retention_days < 1 or p_retention_days > 365 then
    raise exception 'p_retention_days must be between 1 and 365'
      using errcode = '22023';
  end if;

  if p_batch_limit is null or p_batch_limit < 1 or p_batch_limit > 50000 then
    raise exception 'p_batch_limit must be between 1 and 50000'
      using errcode = '22023';
  end if;

  v_retention := make_interval(days => p_retention_days);

  with doomed as (
    select jr.ctid
    from public.job_runs jr
    where jr.started_at < clock_timestamp() - v_retention
    limit p_batch_limit
  ),
  deleted as (
    delete from public.job_runs jr
    using doomed d
    where jr.ctid = d.ctid
    returning 1
  )
  select count(*)::int into v_deleted_count from deleted;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  if v_deleted_count > 0 then
    raise log 'cns_prune_job_runs deleted=% retention_days=% batch_limit=%',
      v_deleted_count,
      p_retention_days,
      p_batch_limit;
  end if;

  return jsonb_build_object(
    'deleted_count', v_deleted_count,
    'retention_days', p_retention_days,
    'batch_limit', p_batch_limit,
    'duration_ms', v_duration_ms
  );
end;
$$;

comment on function public.cns_prune_job_runs(int, int) is
  'Deletes job_runs rows older than retention window; uses job_runs_name_started_idx.';

revoke all on function public.cns_prune_job_runs(int, int) from public;
revoke all on function public.cns_prune_job_runs(int, int) from authenticated;
revoke all on function public.cns_prune_job_runs(int, int) from anon;

grant execute on function public.cns_prune_job_runs(int, int) to service_role;

create or replace function public.cron_cns_prune_job_runs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_result jsonb;
begin
  v_job_run_id := public.job_run_begin('cns_prune_job_runs', 'v1');
  v_result := public.cns_prune_job_runs(90, 10000);

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    coalesce((v_result->>'deleted_count')::int, 0),
    coalesce((v_result->>'deleted_count')::int, 0),
    0,
    jsonb_build_object(
      'retention_days', coalesce((v_result->>'retention_days')::int, 90),
      'batch_limit', coalesce((v_result->>'batch_limit')::int, 10000)
    )
  );

  return v_result || jsonb_build_object('job_run_id', v_job_run_id);
exception
  when others then
    perform public.job_run_abort_latest('cns_prune_job_runs', sqlerrm);
    raise;
end;
$$;

comment on function public.cron_cns_prune_job_runs() is
  'pg_cron entrypoint: prune expired job_runs with job_runs telemetry.';

revoke all on function public.cron_cns_prune_job_runs() from public;
revoke all on function public.cron_cns_prune_job_runs() from authenticated;
revoke all on function public.cron_cns_prune_job_runs() from anon;

grant execute on function public.cron_cns_prune_job_runs() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'cns_prune_job_runs';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'cns_prune_job_runs',
  '0 5 * * *',
  $$select public.cron_cns_prune_job_runs();$$
);
