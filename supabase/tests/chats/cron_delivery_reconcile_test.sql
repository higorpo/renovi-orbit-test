-- pgTAP: cns_reconcile_pending_deliveries pg_cron job (design §6.1, task 52, R26-AC01, OAC-06).

begin;

select plan(5);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cron_cns_reconcile_pending_deliveries'
  ),
  'cron_cns_reconcile_pending_deliveries is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.cron_cns_reconcile_pending_deliveries()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cron_cns_reconcile_pending_deliveries()',
    'EXECUTE'
  ),
  'postgres only may execute delivery reconcile cron wrapper'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'cns_reconcile_pending_deliveries'
      and j.schedule = '*/5 * * * *'
      and j.command like '%cron_cns_reconcile_pending_deliveries%'
  ),
  'cns_reconcile_pending_deliveries cron job exists (R26-AC01, OAC-06)'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'cns_reconcile_pending_deliveries'
      and j.active = true
  ),
  'cns_reconcile_pending_deliveries cron job is active'
);

create temp table _cron_delivery_result as
select public.cron_cns_reconcile_pending_deliveries() as result;

select ok(
  (
    select result ? 'processed_count'
      and not coalesce((result->>'skipped')::boolean, false)
    from _cron_delivery_result
  ),
  'cron wrapper always runs reconcile (no feature-flag skip)'
);

select finish();

rollback;
