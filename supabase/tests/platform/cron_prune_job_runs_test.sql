-- pgTAP: cns_prune_job_runs retention and pg_cron job.

begin;

select plan(8);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_prune_job_runs'
  ),
  'cns_prune_job_runs is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.cns_prune_job_runs(int, int)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cns_prune_job_runs(int, int)',
    'EXECUTE'
  ),
  'service_role only may execute job_runs prune batch RPC'
);

insert into public.job_runs (job_name, started_at, finished_at, processed_count)
values
  ('_pgtap_fixture_old', timestamptz '2000-01-01 00:00:00+00', now(), 1),
  ('_pgtap_fixture_recent', now() - interval '1 day', now(), 1);

select ok(
  (
    select (public.cns_prune_job_runs(90, 10000)->>'deleted_count')::int >= 1
  ),
  'prune deletes at least one row older than retention'
);

select ok(
  (
    select not exists (
      select 1
      from public.job_runs
      where job_name = '_pgtap_fixture_old'
    )
  ),
  'old fixture row is removed'
);

select ok(
  (
    select exists (
      select 1
      from public.job_runs
      where job_name = '_pgtap_fixture_recent'
    )
  ),
  'recent fixture row remains after prune'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'cns_prune_job_runs'
      and j.schedule = '0 5 * * *'
      and j.command like '%cron_cns_prune_job_runs%'
  ),
  'cns_prune_job_runs cron job exists'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'cns_prune_job_runs'
      and j.active = true
  ),
  'cns_prune_job_runs cron job is active'
);

select is(
  (
    select (public.cns_prune_job_runs(90, 10000)->>'retention_days')::int
  ),
  90,
  'retention_days echoed in prune result'
);

select finish();

rollback;
