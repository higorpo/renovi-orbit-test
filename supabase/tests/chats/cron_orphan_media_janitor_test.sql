-- pgTAP: cns_janitor_orphan_media pg_cron job (design §6.1, task 50, R26-AC02, OAC-06).

begin;

select plan(4);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cron_cns_janitor_orphan_media'
  ),
  'cron_cns_janitor_orphan_media is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.cron_cns_janitor_orphan_media()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cron_cns_janitor_orphan_media()',
    'EXECUTE'
  ),
  'postgres only may execute orphan media cron wrapper'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'cns_janitor_orphan_media'
      and j.schedule = '0 3 * * *'
      and j.command like '%cron_cns_janitor_orphan_media%'
  ),
  'cns_janitor_orphan_media cron job exists (R26-AC02, OAC-06)'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'cns_janitor_orphan_media'
      and j.active = true
  ),
  'cns_janitor_orphan_media cron job is active'
);

select finish();

rollback;
