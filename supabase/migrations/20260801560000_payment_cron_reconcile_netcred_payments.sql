-- Payment Task 58: payment_cron_reconcile_netcred_payments wrapper (design.md §6.4).

create or replace function public.payment_cron_reconcile_netcred_payments()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'reconcile-netcred-payments';
  v_edge_slug constant text := 'reconcile-netcred-payments';
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

comment on function public.payment_cron_reconcile_netcred_payments() is
  'pg_cron entrypoint: invoke reconcile-netcred-payments EF with job_runs telemetry.';

revoke all on function public.payment_cron_reconcile_netcred_payments() from public;
revoke all on function public.payment_cron_reconcile_netcred_payments() from anon;
revoke all on function public.payment_cron_reconcile_netcred_payments() from authenticated;

grant execute on function public.payment_cron_reconcile_netcred_payments() to postgres;

-- Rollout: enable after EF smoke tests (design.md §6.4).
-- select cron.schedule(
--   'reconcile-netcred-payments',
--   '*/30 * * * *',
--   $$select public.payment_cron_reconcile_netcred_payments();$$
-- );
-- update cron.job
-- set active = false
-- where jobname = 'reconcile-netcred-payments';
