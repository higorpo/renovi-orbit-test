-- Payment Task 100: register all payment pg_cron jobs (active on deploy).
-- Depends on payment_cron_* wrappers (tasks 51–58).

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $register$
declare
  v_job record;
  v_jobid integer;
begin
  for v_job in
    select *
    from (
      values
        (
          'payment_recover_orphaned_schedules'::text,
          '*/30 * * * *'::text,
          $$select public.payment_cron_recover_orphaned_schedules();$$::text
        ),
        (
          'process-webhook-retry',
          '*/5 * * * *',
          $$select public.payment_cron_process_webhook_retry();$$
        ),
        (
          'reconcile-netcred-payments',
          '*/30 * * * *',
          $$select public.payment_cron_reconcile_netcred_payments();$$
        ),
        (
          'notify-upcoming-charges',
          '30 9,15,21,3 * * *',
          $$select public.payment_cron_notify_upcoming_charges();$$
        ),
        (
          'auto-cancel-unpaid-services',
          '15 9,15,21,3 * * *',
          $$select public.payment_cron_auto_cancel_unpaid_services();$$
        ),
        (
          'schedule-netcred-charges',
          '0 9,15,21,3 * * *',
          $$select public.payment_cron_schedule_netcred_charges();$$
        ),
        (
          'detect-netcred-onboarding',
          '0 10 * * *',
          $$select public.payment_cron_detect_netcred_onboarding();$$
        ),
        (
          'auto-complete-executed-services',
          '45 9,15,21,3 * * *',
          $$select public.payment_cron_auto_complete_executed_services();$$
        ),
        (
          'payment-emit-sentry-spike-alerts',
          '*/5 * * * *',
          $$select public.payment_cron_emit_sentry_spike_alerts();$$
        )
    ) as jobs(jobname, schedule, command)
  loop
    select j.jobid
    into v_jobid
    from cron.job j
    where j.jobname = v_job.jobname;

    if v_jobid is not null then
      perform cron.unschedule(v_jobid);
    end if;

    perform cron.schedule(v_job.jobname, v_job.schedule, v_job.command);
  end loop;
end;
$register$;
