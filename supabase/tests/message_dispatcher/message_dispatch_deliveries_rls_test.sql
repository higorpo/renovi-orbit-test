-- pgTAP: message_dispatch_deliveries RLS (design §3.8, task 15).

begin;

select plan(4);

select ok(
  c.relrowsecurity,
  'message_dispatch_deliveries has RLS enabled'
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'message_dispatcher'
  and c.relname = 'message_dispatch_deliveries';

select ok(
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'message_dispatcher'
      and p.tablename = 'message_dispatch_deliveries'
      and p.policyname = 'message_dispatch_deliveries_select_owner'
      and p.cmd = 'SELECT'
  ),
  'SELECT policy scoped via owned dispatch'
);

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_dispatch_deliveries', 'INSERT')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatch_deliveries', 'UPDATE')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatch_deliveries', 'DELETE'),
  'authenticated cannot mutate deliveries'
);

select ok(
  has_table_privilege('authenticated', 'message_dispatcher.message_dispatch_deliveries', 'SELECT'),
  'authenticated retains SELECT on deliveries'
);

select finish();

rollback;
