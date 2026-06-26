-- Payment Task 57: payment_cron_detect_netcred_onboarding wrapper (design.md §6.4).

create or replace function public.payment_cron_detect_netcred_onboarding()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'detect-netcred-onboarding';
  v_edge_slug constant text := 'detect-netcred-onboarding';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_request_id bigint;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    v_request_id := public.payment_cron_invoke_edge_function(v_edge_slug);

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      0,
      0,
      0,
      jsonb_build_object(
        'pg_net_request_id', v_request_id,
        'edge_function', v_edge_slug
      ),
      null
    );
  exception
    when others then
      perform public.job_run_abort_latest(v_job_name, sqlerrm);
      raise;
  end;
end;
$$;

comment on function public.payment_cron_detect_netcred_onboarding() is
  'pg_cron entrypoint: invoke detect-netcred-onboarding EF with job_runs telemetry.';

revoke all on function public.payment_cron_detect_netcred_onboarding() from public;
revoke all on function public.payment_cron_detect_netcred_onboarding() from anon;
revoke all on function public.payment_cron_detect_netcred_onboarding() from authenticated;

grant execute on function public.payment_cron_detect_netcred_onboarding() to postgres;

-- Rollout: enable after EF smoke tests (design.md §6.4).
-- select cron.schedule(
--   'detect-netcred-onboarding',
--   '0 10 * * *',
--   $$select public.payment_cron_detect_netcred_onboarding();$$
-- );
-- update cron.job
-- set active = false
-- where jobname = 'detect-netcred-onboarding';
