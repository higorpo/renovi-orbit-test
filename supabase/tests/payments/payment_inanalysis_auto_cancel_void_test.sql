-- pgTAP: Payment Task 113 — IN_ANALYSIS auto-cancel gateway void I/O path.

begin;
select plan(10);

select has_function(
  'public',
  'payment_claim_inanalysis_auto_cancel_void_batch',
  array['integer'],
  'payment_claim_inanalysis_auto_cancel_void_batch exists'
);

select has_function(
  'public',
  'payment_commit_inanalysis_auto_cancel_void_outcome',
  array['uuid', 'text', 'text', 'text'],
  'payment_commit_inanalysis_auto_cancel_void_outcome exists'
);

select has_function(
  'public',
  'payment_cron_reconcile_inanalysis_auto_cancel_voids',
  array[]::text[],
  'payment_cron_reconcile_inanalysis_auto_cancel_voids exists'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_claim_inanalysis_auto_cancel_void_batch'
  ),
  'payment_claim_inanalysis_auto_cancel_void_batch is SECURITY DEFINER'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'IN_ANALYSIS_VOID_RECONCILED'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_claim_inanalysis_auto_cancel_void_batch'
  ),
  'claim RPC excludes already reconciled schedules'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_cron_invoke_edge_function'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_reconcile_inanalysis_auto_cancel_voids'
  ),
  'cron wrapper delegates to payment_cron_invoke_edge_function'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'reconcile-inanalysis-auto-cancel-voids'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_reconcile_inanalysis_auto_cancel_voids'
  ),
  'cron wrapper targets reconcile-inanalysis-auto-cancel-voids EF'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'requires_gateway_reconcile'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_auto_cancel_unpaid_services'
  ),
  'auto-cancel cron wrapper checks requires_gateway_reconcile flag'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.payment_cron_reconcile_inanalysis_auto_cancel_voids()',
    'EXECUTE'
  ),
  'postgres can execute payment_cron_reconcile_inanalysis_auto_cancel_voids'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_cron_reconcile_inanalysis_auto_cancel_voids()',
    'EXECUTE'
  ),
  'authenticated cannot execute payment_cron_reconcile_inanalysis_auto_cancel_voids'
);

select * from finish();
rollback;
