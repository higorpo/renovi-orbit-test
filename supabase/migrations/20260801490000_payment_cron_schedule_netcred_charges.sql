-- Payment Task 51: payment_cron_schedule_netcred_charges wrapper (design.md §6.4).
-- Depends on payment_cron_invoke_edge_function (task 59, migration 20260801485000).

create or replace function public.payment_cron_schedule_netcred_charges()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'schedule-netcred-charges';
  v_edge_slug constant text := 'schedule-netcred-charges';
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

comment on function public.payment_cron_schedule_netcred_charges() is
  'pg_cron entrypoint: invoke schedule-netcred-charges EF with job_runs telemetry.';

revoke all on function public.payment_cron_schedule_netcred_charges() from public;
revoke all on function public.payment_cron_schedule_netcred_charges() from anon;
revoke all on function public.payment_cron_schedule_netcred_charges() from authenticated;

grant execute on function public.payment_cron_schedule_netcred_charges() to postgres;

-- Rollout: enable after EF smoke tests (design.md §6.4).
-- select cron.schedule(
--   'schedule-netcred-charges',
--   '0 9,15,21,3 * * *',
--   $$select public.payment_cron_schedule_netcred_charges();$$
-- );
-- update cron.job
-- set active = false
-- where jobname = 'schedule-netcred-charges';
