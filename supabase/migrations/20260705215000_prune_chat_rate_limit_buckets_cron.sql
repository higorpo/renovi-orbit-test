-- CNS maintenance — prune expired chat_rate_limit_buckets (design §3.14 index comment).
-- Migration order: runs AFTER chat_rate_limit_buckets and job_run helpers.

create or replace function public.cns_prune_chat_rate_limit_buckets(
  p_retention_hours int default 24,
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
  if p_retention_hours is null or p_retention_hours < 1 or p_retention_hours > 168 then
    raise exception 'p_retention_hours must be between 1 and 168'
      using errcode = '22023';
  end if;

  if p_batch_limit is null or p_batch_limit < 1 or p_batch_limit > 50000 then
    raise exception 'p_batch_limit must be between 1 and 50000'
      using errcode = '22023';
  end if;

  v_retention := make_interval(hours => p_retention_hours);

  with doomed as (
    select b.ctid
    from public.chat_rate_limit_buckets b
    where b.window_started_at < clock_timestamp() - v_retention
    limit p_batch_limit
  ),
  deleted as (
    delete from public.chat_rate_limit_buckets b
    using doomed d
    where b.ctid = d.ctid
    returning 1
  )
  select count(*)::int into v_deleted_count from deleted;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  if v_deleted_count > 0 then
    raise log 'cns_prune_chat_rate_limit_buckets deleted=% retention_hours=% batch_limit=%',
      v_deleted_count,
      p_retention_hours,
      p_batch_limit;
  end if;

  return jsonb_build_object(
    'deleted_count', v_deleted_count,
    'retention_hours', p_retention_hours,
    'batch_limit', p_batch_limit,
    'duration_ms', v_duration_ms
  );
end;
$$;

comment on function public.cns_prune_chat_rate_limit_buckets(int, int) is
  'Deletes minute buckets older than retention window; uses chat_rate_limit_buckets_window_started_idx (R3 maintenance).';

revoke all on function public.cns_prune_chat_rate_limit_buckets(int, int) from public;
revoke all on function public.cns_prune_chat_rate_limit_buckets(int, int) from authenticated;
revoke all on function public.cns_prune_chat_rate_limit_buckets(int, int) from anon;

grant execute on function public.cns_prune_chat_rate_limit_buckets(int, int) to service_role;

create or replace function public.cron_cns_prune_chat_rate_limit_buckets()
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
  v_job_run_id := public.job_run_begin('cns_prune_chat_rate_limit_buckets', 'v1');
  v_result := public.cns_prune_chat_rate_limit_buckets(24, 10000);

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    coalesce((v_result->>'deleted_count')::int, 0),
    coalesce((v_result->>'deleted_count')::int, 0),
    0,
    jsonb_build_object(
      'retention_hours', coalesce((v_result->>'retention_hours')::int, 24),
      'batch_limit', coalesce((v_result->>'batch_limit')::int, 10000)
    )
  );

  return v_result || jsonb_build_object('job_run_id', v_job_run_id);
exception
  when others then
    perform public.job_run_abort_latest('cns_prune_chat_rate_limit_buckets', sqlerrm);
    raise;
end;
$$;

comment on function public.cron_cns_prune_chat_rate_limit_buckets() is
  'pg_cron entrypoint: prune expired chat_rate_limit_buckets with job_runs telemetry.';

revoke all on function public.cron_cns_prune_chat_rate_limit_buckets() from public;
revoke all on function public.cron_cns_prune_chat_rate_limit_buckets() from authenticated;
revoke all on function public.cron_cns_prune_chat_rate_limit_buckets() from anon;

grant execute on function public.cron_cns_prune_chat_rate_limit_buckets() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'cns_prune_chat_rate_limit_buckets';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'cns_prune_chat_rate_limit_buckets',
  '0 4 * * *',
  $$select public.cron_cns_prune_chat_rate_limit_buckets();$$
);
