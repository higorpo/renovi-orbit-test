-- CNS Phase 5 — task 48: pg_cron schedule for domain_events processor (design §6.1, Req. 28, R28-AC02, OAC-06).
-- Migration order: runs AFTER tasks 44, 45, 47.

create or replace function public.cron_cns_process_domain_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.domain_events_release_stale_leases();
  return public.cns_process_domain_events(100);
end;
$$;

comment on function public.cron_cns_process_domain_events() is
  'pg_cron entrypoint: stale lease janitor then domain_events batch processor with job_runs telemetry (R28-AC02, OAC-06).';

revoke all on function public.cron_cns_process_domain_events() from public;
revoke all on function public.cron_cns_process_domain_events() from authenticated;
revoke all on function public.cron_cns_process_domain_events() from anon;

grant execute on function public.cron_cns_process_domain_events() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'cns_process_domain_events';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'cns_process_domain_events',
  '* * * * *',
  $$select public.cron_cns_process_domain_events();$$
);
