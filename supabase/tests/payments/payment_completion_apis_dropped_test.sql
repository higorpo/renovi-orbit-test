-- pgTAP: Task 40 / ADR-0004 — legacy payment_* completion writers are DROPPed.

begin;

select plan(5);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_mark_service_executed'
  ),
  'payment_mark_service_executed is dropped'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_confirm_service_completed'
  ),
  'payment_confirm_service_completed is dropped'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_auto_complete_executed_services'
  ),
  'payment_cron_auto_complete_executed_services is dropped'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_auto_complete_executed_services'
  ),
  'payment_auto_complete_executed_services is dropped'
);

select ok(
  not exists (
    select 1
    from cron.job j
    where j.jobname = 'auto-complete-executed-services'
  ),
  'legacy auto-complete-executed-services cron job is unscheduled'
);

select * from finish();
rollback;
