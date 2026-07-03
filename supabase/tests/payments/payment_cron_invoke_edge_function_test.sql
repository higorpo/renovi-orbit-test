-- pgTAP: payment Task 59 — payment_cron_invoke_edge_function wrapper delegates to orbit helper.

begin;

select plan(5);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_invoke_edge_function'
  ),
  'payment_cron_invoke_edge_function exists'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'orbit_invoke_edge_function'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_invoke_edge_function'
  ),
  'delegates to orbit_invoke_edge_function'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_invoke_edge_function'
  ),
  'payment_cron_invoke_edge_function is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.payment_cron_invoke_edge_function(text)'::regprocedure,
    'EXECUTE'
  ),
  'postgres can execute payment_cron_invoke_edge_function'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_cron_invoke_edge_function(text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute payment_cron_invoke_edge_function'
);

select * from finish();
rollback;
