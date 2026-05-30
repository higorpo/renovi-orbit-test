-- CNS Phase 5 — task 50: pg_cron schedule for orphan media janitor (design §6.1, Req. 26, R26-AC02, OAC-06).
-- Migration order: runs AFTER task 49.

create or replace function public.cron_cns_janitor_orphan_media()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_result jsonb;
  v_duration_ms int;
begin
  insert into public.job_runs (job_name, started_at)
  values ('cns_janitor_orphan_media', v_started_at)
  returning id into v_job_run_id;

  v_result := public.cns_janitor_orphan_media(500);

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  update public.job_runs
  set
    finished_at = now(),
    processed_count = coalesce((v_result->>'processed_count')::int, 0),
    transitioned_count = coalesce((v_result->>'expired_count')::int, 0),
    error_count = coalesce((v_result->>'delete_failures')::int, 0),
    duration_ms = v_duration_ms,
    metadata = jsonb_build_object(
      'bytes_deleted', coalesce((v_result->>'bytes_deleted')::bigint, 0),
      'objects_deleted', coalesce((v_result->>'objects_deleted')::int, 0)
    )
  where id = v_job_run_id;

  return v_result || jsonb_build_object('job_run_id', v_job_run_id);
end;
$$;

comment on function public.cron_cns_janitor_orphan_media() is
  'pg_cron entrypoint: orphan chat-media janitor with job_runs telemetry (R26-AC02, OAC-06).';

revoke all on function public.cron_cns_janitor_orphan_media() from public;
revoke all on function public.cron_cns_janitor_orphan_media() from authenticated;
revoke all on function public.cron_cns_janitor_orphan_media() from anon;

grant execute on function public.cron_cns_janitor_orphan_media() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'cns_janitor_orphan_media';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'cns_janitor_orphan_media',
  '0 3 * * *',
  $$select public.cron_cns_janitor_orphan_media();$$
);
