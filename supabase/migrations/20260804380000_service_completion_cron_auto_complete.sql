-- Service completion Task 38: service_completion_cron_auto_complete_executed + job_runs + schedule.
-- Replaces payment_cron_auto_complete cadence after Task 40 DROP (design §4.5 / §10.2).

create or replace function public.service_completion_cron_auto_complete_executed()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'service_completion_cron_auto_complete_executed';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_result jsonb;
  v_completed_count int := 0;
  v_error_count int := 0;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    v_result := public.service_completion_auto_complete_executed(null);
    v_completed_count := coalesce((v_result->>'completed_count')::int, 0);
    v_error_count := coalesce((v_result->>'errors_count')::int, 0);

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      v_completed_count + v_error_count,
      v_completed_count,
      v_error_count,
      jsonb_build_object(
        'completed_by', 'system',
        'completed_count', v_completed_count,
        'errors_count', v_error_count,
        'grace_hours', v_result->'grace_hours',
        'error_samples', coalesce(v_result->'error_samples', '[]'::jsonb),
        'completed', coalesce(v_result->'completed', '[]'::jsonb)
      ),
      case when v_error_count > 0 then 'row_errors' else null end
    );

    return v_result || jsonb_build_object('job_run_id', v_job_run_id);
  exception
    when others then
      perform public.job_run_abort_latest(v_job_name, sqlerrm);
      raise;
  end;
end;
$$;

comment on function public.service_completion_cron_auto_complete_executed() is
  'pg_cron entrypoint: service_completion_auto_complete_executed with job_runs telemetry (Task 38).';

revoke all on function public.service_completion_cron_auto_complete_executed()
  from public, anon, authenticated;
grant execute on function public.service_completion_cron_auto_complete_executed()
  to postgres;

-- Align with prior payment auto-complete cadence (45 past 9/15/21/3 UTC).
do $register$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'service_completion_auto_complete_executed';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'service_completion_auto_complete_executed',
    '45 9,15,21,3 * * *',
    $$select public.service_completion_cron_auto_complete_executed();$$
  );
end;
$register$;
