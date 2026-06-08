-- pgTAP: proposal_expiring_soon_reminders pg_cron job (replaces cns_process_domain_events schedule).

begin;

select plan(5);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cron_enqueue_proposal_expiring_soon_reminders'
  ),
  'cron_enqueue_proposal_expiring_soon_reminders is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.cron_enqueue_proposal_expiring_soon_reminders()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cron_enqueue_proposal_expiring_soon_reminders()',
    'EXECUTE'
  ),
  'postgres only may execute proposal expiring soon cron wrapper'
);

select ok(
  not exists (
    select 1
    from cron.job j
    where j.jobname = 'cns_process_domain_events'
  ),
  'cns_process_domain_events cron job is unscheduled'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'proposal_expiring_soon_reminders'
      and j.schedule = '* * * * *'
      and j.command like '%cron_enqueue_proposal_expiring_soon_reminders%'
  ),
  'proposal_expiring_soon_reminders cron job exists'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'proposal_expiring_soon_reminders'
      and j.active = true
  ),
  'proposal_expiring_soon_reminders cron job is active'
);

select finish();

rollback;
