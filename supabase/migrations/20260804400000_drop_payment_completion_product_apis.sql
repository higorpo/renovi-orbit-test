-- Service completion Task 40 (ADR-0004): DROP legacy payment_* completion product writers.
-- Ops note: EXECUTED/COMPLETED self-serve + system auto-complete now live only under
-- service_completion_* (mark_executed, confirm_with_rating, auto_complete_executed + cron).
-- NetCred charge/refund/settlement payment_* RPCs are unchanged.
-- Cron job `auto-complete-executed-services` is unscheduled; replacement is
-- `service_completion_auto_complete_executed` (Task 38).

do $unschedule$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'auto-complete-executed-services';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$unschedule$;

-- Cron wrapper first (depends on batch RPC), then batch + authenticated writers.
drop function if exists public.payment_cron_auto_complete_executed_services();
drop function if exists public.payment_auto_complete_executed_services();
drop function if exists public.payment_mark_service_executed(uuid);
drop function if exists public.payment_confirm_service_completed(uuid);

comment on column public.contracted_services.executed_at is
  'Timestamp when provider marked the service EXECUTED (service_completion_mark_executed).';
