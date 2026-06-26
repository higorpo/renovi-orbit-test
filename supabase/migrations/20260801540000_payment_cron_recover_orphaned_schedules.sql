-- Payment Task 56: payment_cron_recover_orphaned_schedules wrapper (design.md §4.6, §6.4).

create or replace function public.payment_cron_recover_orphaned_schedules()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'payment_recover_orphaned_schedules';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_recovered_count int;
  v_recovered_to_scheduled int;
  v_recovered_to_failed int;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    select r.recovered_count, r.recovered_to_scheduled, r.recovered_to_failed
    into v_recovered_count, v_recovered_to_scheduled, v_recovered_to_failed
    from public.payment_recover_orphaned_schedules() as r;

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      coalesce(v_recovered_count, 0),
      coalesce(v_recovered_to_scheduled, 0) + coalesce(v_recovered_to_failed, 0),
      0,
      jsonb_build_object(
        'recovered_to_scheduled', coalesce(v_recovered_to_scheduled, 0),
        'recovered_to_failed', coalesce(v_recovered_to_failed, 0),
        'recovered_count', coalesce(v_recovered_count, 0)
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

comment on function public.payment_cron_recover_orphaned_schedules() is
  'pg_cron entrypoint: expired PROCESSING lease janitor with job_runs telemetry.';

revoke all on function public.payment_cron_recover_orphaned_schedules() from public;
revoke all on function public.payment_cron_recover_orphaned_schedules() from anon;
revoke all on function public.payment_cron_recover_orphaned_schedules() from authenticated;

grant execute on function public.payment_cron_recover_orphaned_schedules() to postgres;

-- Rollout: enable after payment_recover_orphaned_schedules smoke tests (design.md §6.4).
-- select cron.schedule(
--   'payment_recover_orphaned_schedules',
--   '*/30 * * * *',
--   $$select public.payment_cron_recover_orphaned_schedules();$$
-- );
-- update cron.job
-- set active = false
-- where jobname = 'payment_recover_orphaned_schedules';
