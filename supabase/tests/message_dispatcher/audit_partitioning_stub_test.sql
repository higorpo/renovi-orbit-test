-- pgTAP: audit partitioning growth stub (design §3.6, task 110, Req. 6 AC3).

begin;

select plan(4);

select is(
  (
    select c.relkind::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'message_dispatcher'
      and c.relname = 'message_dispatcher_audit'
  ),
  'r',
  'message_dispatcher_audit is ordinary heap table in MVP'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'message_dispatcher'
      and p.proname = 'message_dispatcher_audit_partitioning_growth_stub_sql'
  ),
  'audit_partitioning_growth_stub_sql function exists'
);

select ok(
  message_dispatcher.message_dispatcher_audit_partitioning_growth_stub_sql()
    ilike '%partition by range%created_at%',
  'growth stub SQL mentions RANGE(created_at) partitioning'
);

select ok(
  exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'message_dispatcher'
      and i.tablename = 'message_dispatcher_audit'
      and i.indexname = 'message_dispatcher_audit_dispatch_created_idx'
  ),
  'dispatch_id created_at index present for AC3 timeline queries'
);

select finish();

rollback;
