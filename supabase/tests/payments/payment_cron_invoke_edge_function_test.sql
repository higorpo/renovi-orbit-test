-- pgTAP: payment Task 59 — payment_cron_invoke_edge_function helper grants and shape.

begin;

select plan(6);

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
    select pg_get_functiondef(p.oid) ~* 'net\.http_post'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_invoke_edge_function'
  ),
  'uses pg_net http_post to invoke Edge Functions'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'p_function_name is required'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_cron_invoke_edge_function'
  ),
  'rejects empty function slug'
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
