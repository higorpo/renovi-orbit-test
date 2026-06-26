-- Payment Task 52: payment_cron_auto_cancel_unpaid_services wrapper (design.md §6.4).

create or replace function public.payment_cron_auto_cancel_unpaid_services()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'auto-cancel-unpaid-services';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_result jsonb;
  v_cancelled_count int;
  v_error_count int;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    v_result := public.payment_auto_cancel_services();
    v_cancelled_count := coalesce((v_result->>'cancelled_count')::int, 0);
    v_error_count := coalesce((v_result->>'errors_count')::int, 0);

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      v_cancelled_count + v_error_count,
      v_cancelled_count,
      v_error_count,
      jsonb_build_object(
        'cancelled', v_result->'cancelled',
        'cancelled_count', v_cancelled_count,
        'errors_count', v_error_count
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

comment on function public.payment_cron_auto_cancel_unpaid_services() is
  'pg_cron entrypoint: T-12h auto-cancel batch with job_runs telemetry.';

revoke all on function public.payment_cron_auto_cancel_unpaid_services() from public;
revoke all on function public.payment_cron_auto_cancel_unpaid_services() from anon;
revoke all on function public.payment_cron_auto_cancel_unpaid_services() from authenticated;

grant execute on function public.payment_cron_auto_cancel_unpaid_services() to postgres;

-- Rollout: enable after payment_auto_cancel_services smoke tests (design.md §6.4).
-- select cron.schedule(
--   'auto-cancel-unpaid-services',
--   '15 9,15,21,3 * * *',
--   $$select public.payment_cron_auto_cancel_unpaid_services();$$
-- );
-- update cron.job
-- set active = false
-- where jobname = 'auto-cancel-unpaid-services';
