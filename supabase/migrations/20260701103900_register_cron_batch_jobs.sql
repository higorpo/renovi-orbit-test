-- CNS Phase 4 — task 40: pg_cron schedules for reciprocity and proposal expiry (design §6.1, Req. 25).
-- Migration order: runs AFTER tasks 38, 39, 12.

-- pg_cron: created in 20260318200000_create_provider_proposals.sql (avoid duplicate CREATE EXTENSION).
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function public.cron_chat_evaluate_reciprocity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.cns_evaluate_reciprocity_batch(500);
end;
$$;

comment on function public.cron_chat_evaluate_reciprocity() is
  'pg_cron entrypoint: ACTIVE chat reciprocity batch with job_runs telemetry (R25-AC01, R25-AC05, OAC-06).';

create or replace function public.cron_proposal_expire_pending()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.expire_pending_proposals(500);
end;
$$;

comment on function public.cron_proposal_expire_pending() is
  'pg_cron entrypoint: PENDING proposal SLA expiry batch with job_runs telemetry (R25-AC02, R25-AC05, OAC-06).';

revoke all on function public.cron_chat_evaluate_reciprocity() from public;
revoke all on function public.cron_chat_evaluate_reciprocity() from authenticated;
revoke all on function public.cron_chat_evaluate_reciprocity() from anon;

revoke all on function public.cron_proposal_expire_pending() from public;
revoke all on function public.cron_proposal_expire_pending() from authenticated;
revoke all on function public.cron_proposal_expire_pending() from anon;

grant execute on function public.cron_chat_evaluate_reciprocity() to postgres;
grant execute on function public.cron_proposal_expire_pending() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'chat_evaluate_reciprocity';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'chat_evaluate_reciprocity',
  '*/10 * * * *',
  $$select public.cron_chat_evaluate_reciprocity();$$
);

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'proposal_expire_pending';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'proposal_expire_pending',
  '*/10 * * * *',
  $$select public.cron_proposal_expire_pending();$$
);
