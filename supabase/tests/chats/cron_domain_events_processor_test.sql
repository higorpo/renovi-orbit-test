-- pgTAP: cns_process_domain_events pg_cron job (design §6.1, task 48, R28-AC02, OAC-06).

begin;

select plan(5);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cron_cns_process_domain_events'
  ),
  'cron_cns_process_domain_events is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.cron_cns_process_domain_events()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cron_cns_process_domain_events()',
    'EXECUTE'
  ),
  'postgres only may execute domain events cron wrapper'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'cns_process_domain_events'
      and j.schedule = '* * * * *'
      and j.command like '%cron_cns_process_domain_events%'
  ),
  'cns_process_domain_events cron job exists (R28-AC02, OAC-06)'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'cns_process_domain_events'
      and j.active = true
  ),
  'cns_process_domain_events cron job is active'
);

select ok(
  (
    select pg_get_functiondef(p.oid) like '%domain_events_release_stale_leases%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cron_cns_process_domain_events'
  ),
  'cron wrapper calls domain_events_release_stale_leases before processor'
);

select finish();

rollback;
