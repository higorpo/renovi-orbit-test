-- pgTAP: all MMD SECURITY DEFINER functions set search_path (design §11.1, task 94).

begin;

select plan(2);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'message_dispatcher'
      and p.prosecdef
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=message_dispatcher,%'
          and cfg like '%public%'
          and cfg like '%auth%'
      )
  ),
  0,
  'every SECURITY DEFINER function includes message_dispatcher, public, auth in search_path'
);

select ok(
  (
    select count(*) >= 10
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'message_dispatcher'
      and p.prosecdef
  ),
  'expected number of SECURITY DEFINER MMD functions present'
);

select finish();

rollback;
