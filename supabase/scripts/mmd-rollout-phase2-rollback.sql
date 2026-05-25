-- Phase 2 emergency rollback (task 120, design §8.5). Retains schema and dispatch rows.

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'mmd_invoke_worker';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
    raise notice 'Rollback: unscheduled mmd_invoke_worker (jobid=%)', v_jobid;
  end if;
end;
$cron$;

-- Stop pg_net POSTs even if cron is re-added by mistake (worker_url lives in vault)
update vault.secrets
set secret = ''
where name = 'dispatcher_worker_url';

-- Optional nuclear: uncomment to block worker RPCs (re-enable requires GRANT after incident)
-- revoke execute on function message_dispatcher.message_dispatcher_checkout_batch(text, integer) from service_role;
-- revoke execute on function message_dispatcher.message_dispatcher_report_delivery_outcome(
--   uuid, text, message_dispatcher.message_channel, boolean, text, integer, text, text, jsonb, boolean
-- ) from service_role;
