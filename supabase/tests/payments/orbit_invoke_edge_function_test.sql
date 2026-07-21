-- pgTAP: orbit_invoke_edge_function — canonical internal pg_net helper.

begin;

select plan(8);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'orbit_invoke_edge_function'
  ),
  'orbit_invoke_edge_function exists'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'net\.http_post'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'orbit_invoke_edge_function'
  ),
  'uses pg_net http_post'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'X-Orbit-Cron-Secret'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'orbit_invoke_edge_function'
  ),
  'sends X-Orbit-Cron-Secret header'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'message-dispatcher-worker'
      and pg_get_functiondef(p.oid) ~* 'payment-emit-sentry-alerts'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'orbit_invoke_edge_function'
  ),
  'allowlist includes MMD and payment internal slugs'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'orbit_invoke_edge_function'
  ),
  'orbit_invoke_edge_function is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.orbit_invoke_edge_function(text, jsonb, int)'::regprocedure,
    'EXECUTE'
  ),
  'postgres can execute orbit_invoke_edge_function'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.orbit_invoke_edge_function(text, jsonb, int)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute orbit_invoke_edge_function'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'orbit_invoke_edge_function'
      and pg_get_functiondef(p.oid) ~* '90000'
      and pg_get_functiondef(p.oid) ~* 'schedule-netcred-charges'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_invoke_edge_function'
  ),
  'payment_cron_invoke uses 90s timeout for schedule-netcred-charges'
);

select * from finish();
rollback;
