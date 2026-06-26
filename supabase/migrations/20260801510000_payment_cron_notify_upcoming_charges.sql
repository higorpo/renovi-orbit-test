-- Payment Task 53: payment_cron_notify_upcoming_charges wrapper (design.md §6.4).

create or replace function public.payment_cron_notify_upcoming_charges()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'notify-upcoming-charges';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_result jsonb;
  v_item jsonb;
  v_notified_count int := 0;
  v_batch_errors int;
  v_enqueued_count int := 0;
  v_mmd_errors int := 0;
  v_schedule_id uuid;
  v_notified_ids jsonb := '[]'::jsonb;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    v_result := public.payment_notify_upcoming_charges_batch();
    v_batch_errors := coalesce((v_result->>'errors_count')::int, 0);

    for v_item in
      select value
      from jsonb_array_elements(coalesce(v_result->'candidates', '[]'::jsonb))
    loop
      v_schedule_id := (v_item->>'schedule_id')::uuid;

      begin
        perform public.payment_enqueue_notifications(
          v_schedule_id,
          'UPCOMING_CHARGE'
        );

        if public.payment_confirm_upcoming_charge_notified(v_schedule_id) then
          v_notified_count := v_notified_count + 1;
          v_notified_ids := v_notified_ids || jsonb_build_array(v_schedule_id::text);
        end if;

        v_enqueued_count := v_enqueued_count + 1;
      exception
        when others then
          v_mmd_errors := v_mmd_errors + 1;
          raise warning
            'payment_cron_notify_upcoming_charges mmd failed schedule_id=% sqlstate=% message=%',
            v_schedule_id,
            sqlstate,
            sqlerrm;
      end;
    end loop;

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      v_notified_count,
      v_enqueued_count,
      v_batch_errors + v_mmd_errors,
      jsonb_build_object(
        'candidate_count', coalesce((v_result->>'candidate_count')::int, 0),
        'notified_count', v_notified_count,
        'enqueued_count', v_enqueued_count,
        'batch_errors_count', v_batch_errors,
        'mmd_errors_count', v_mmd_errors,
        'notified_schedule_ids', v_notified_ids
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

comment on function public.payment_cron_notify_upcoming_charges() is
  'pg_cron entrypoint: pre-charge notification batch, MMD enqueue, then confirm mark with job_runs telemetry.';

revoke all on function public.payment_cron_notify_upcoming_charges() from public;
revoke all on function public.payment_cron_notify_upcoming_charges() from anon;
revoke all on function public.payment_cron_notify_upcoming_charges() from authenticated;

grant execute on function public.payment_cron_notify_upcoming_charges() to postgres;

-- Rollout: enable after payment_notify_upcoming_charges_batch smoke tests (design.md §6.4).
-- select cron.schedule(
--   'notify-upcoming-charges',
--   '30 9,15,21,3 * * *',
--   $$select public.payment_cron_notify_upcoming_charges();$$
-- );
-- update cron.job
-- set active = false
-- where jobname = 'notify-upcoming-charges';
