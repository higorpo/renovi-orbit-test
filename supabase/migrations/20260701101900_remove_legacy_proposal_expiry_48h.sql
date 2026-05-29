-- CNS Wave A — task 20: remove legacy 48h proposal expiry path (design Schema evolution).
-- Cutover: disable legacy cron/triggers here; enable cns_expire_pending_proposals in Wave E (task 46).
-- Avoid running legacy and 24h expiry jobs concurrently in the same environment.

do $drop$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'expire_stale_provider_proposals';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
    raise notice 'Dropped pg_cron job: expire_stale_provider_proposals (jobid=%)', v_jobid;
  else
    raise notice 'pg_cron job expire_stale_provider_proposals not found (already removed)';
  end if;
end;
$drop$;

drop trigger if exists provider_proposals_enforce_client_response_deadline
  on public.provider_proposals;

drop trigger if exists provider_proposals_sync_client_response_deadline
  on public.provider_proposals;

drop function if exists public.enforce_provider_proposal_client_response_deadline();
drop function if exists public.sync_provider_proposal_client_response_deadline();
drop function if exists public.expire_stale_provider_proposals();

do $obs$
begin
  raise notice 'Legacy 48h proposal expiry removed: triggers enforce/sync client_response_deadline, function expire_stale_provider_proposals';
  raise notice 'Next: Wave E cns_expire_pending_proposals uses submitted_at + platform_constant_int(chats.proposal_response_sla_hours, 24)';
end;
$obs$;
