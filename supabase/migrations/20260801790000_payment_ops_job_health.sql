-- Payment Task 130: post-rollout job_runs health helper for payment crons (Req 21.5).

create or replace function public.payment_ops_job_health(
  p_lookback_hours int default 24,
  p_stale_minutes int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_ops_job_health'
      using errcode = '42501';
  end if;

  with payment_jobs as (
    select unnest(array[
      'payment_recover_orphaned_schedules',
      'process-webhook-retry',
      'reconcile-netcred-payments',
      'reconcile-inanalysis-auto-cancel-voids',
      'notify-upcoming-charges',
      'auto-cancel-unpaid-services',
      'schedule-netcred-charges',
      'detect-netcred-onboarding',
      'auto-complete-executed-services',
      'payment-emit-sentry-spike-alerts'
    ]::text[]) as job_name
  ),
  lookback as (
    select greatest(coalesce(p_lookback_hours, 24), 1) as hours,
      greatest(coalesce(p_stale_minutes, 30), 5) as stale_minutes
  ),
  recent as (
    select jr.*
    from public.job_runs jr
    inner join payment_jobs pj on pj.job_name = jr.job_name
    cross join lookback lb
    where jr.started_at >= now() - make_interval(hours => lb.hours)
  ),
  latest as (
    select distinct on (r.job_name)
      r.job_name,
      r.id as job_run_id,
      r.started_at,
      r.finished_at,
      r.duration_ms,
      r.processed_count,
      r.transitioned_count,
      r.error_count,
      r.metadata
    from recent r
    order by r.job_name, r.started_at desc
  ),
  per_job as (
    select
      pj.job_name,
      l.job_run_id,
      l.started_at,
      l.finished_at,
      l.duration_ms,
      l.processed_count,
      l.transitioned_count,
      l.error_count,
      l.metadata,
      (l.finished_at is null
        and l.started_at < now() - make_interval(mins => (select stale_minutes from lookback))
      ) as is_stale,
      coalesce(l.error_count, 0) > 0 as has_errors,
      nullif(l.metadata->>'fatal_error', '') is not null as has_fatal_error
    from payment_jobs pj
    left join latest l on l.job_name = pj.job_name
  ),
  stale_runs as (
    select jsonb_agg(
      jsonb_build_object(
        'job_name', r.job_name,
        'job_run_id', r.id,
        'started_at', r.started_at,
        'minutes_running', round(extract(epoch from (now() - r.started_at)) / 60.0, 1)
      )
      order by r.started_at
    ) as rows
    from recent r
    cross join lookback lb
    where r.finished_at is null
      and r.started_at < now() - make_interval(mins => lb.stale_minutes)
  ),
  error_runs as (
    select jsonb_agg(
      jsonb_build_object(
        'job_name', r.job_name,
        'job_run_id', r.id,
        'started_at', r.started_at,
        'finished_at', r.finished_at,
        'error_count', r.error_count,
        'metadata', r.metadata
      )
      order by r.started_at desc
    ) as rows
    from recent r
    where coalesce(r.error_count, 0) > 0
  ),
  fatal_runs as (
    select jsonb_agg(
      jsonb_build_object(
        'job_name', r.job_name,
        'job_run_id', r.id,
        'started_at', r.started_at,
        'finished_at', r.finished_at,
        'fatal_error', r.metadata->>'fatal_error',
        'metadata', r.metadata
      )
      order by r.started_at desc
    ) as rows
    from recent r
    where nullif(r.metadata->>'fatal_error', '') is not null
  )
  select jsonb_build_object(
    'lookback_hours', (select hours from lookback),
    'stale_minutes', (select stale_minutes from lookback),
    'checked_at', now(),
    'summary', jsonb_build_object(
      'jobs_tracked', (select count(*)::int from payment_jobs),
      'jobs_with_recent_run', (select count(*)::int from per_job where job_run_id is not null),
      'stale_run_count', coalesce(jsonb_array_length((select rows from stale_runs)), 0),
      'error_run_count', coalesce(jsonb_array_length((select rows from error_runs)), 0),
      'fatal_run_count', coalesce(jsonb_array_length((select rows from fatal_runs)), 0),
      'healthy', coalesce(jsonb_array_length((select rows from stale_runs)), 0) = 0
        and coalesce(jsonb_array_length((select rows from fatal_runs)), 0) = 0
    ),
    'jobs', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'job_name', pj.job_name,
            'job_run_id', pj.job_run_id,
            'started_at', pj.started_at,
            'finished_at', pj.finished_at,
            'duration_ms', pj.duration_ms,
            'processed_count', pj.processed_count,
            'transitioned_count', pj.transitioned_count,
            'error_count', pj.error_count,
            'is_stale', coalesce(pj.is_stale, false),
            'has_errors', coalesce(pj.has_errors, false),
            'has_fatal_error', coalesce(pj.has_fatal_error, false),
            'fatal_error', pj.metadata->>'fatal_error',
            'metadata', coalesce(pj.metadata, '{}'::jsonb)
          )
          order by pj.job_name
        )
        from per_job pj
      ),
      '[]'::jsonb
    ),
    'stale_runs', coalesce((select rows from stale_runs), '[]'::jsonb),
    'error_runs', coalesce((select rows from error_runs), '[]'::jsonb),
    'fatal_runs', coalesce((select rows from fatal_runs), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.payment_ops_job_health(int, int) is
  'Ops dashboard pack: payment cron job_runs health (stale, error_count>0, metadata.fatal_error).';

revoke all on function public.payment_ops_job_health(int, int) from public;
revoke all on function public.payment_ops_job_health(int, int) from anon;
revoke all on function public.payment_ops_job_health(int, int) from authenticated;

grant execute on function public.payment_ops_job_health(int, int) to service_role;
