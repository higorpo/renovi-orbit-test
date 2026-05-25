-- pgTAP: message_dispatcher_audit RLS (design §3.8, task 14).

begin;

select plan(4);

select ok(
  c.relrowsecurity,
  'message_dispatcher_audit has RLS enabled'
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'message_dispatcher'
  and c.relname = 'message_dispatcher_audit';

select ok(
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'message_dispatcher'
      and p.tablename = 'message_dispatcher_audit'
      and p.policyname = 'message_dispatcher_audit_select_owner'
      and p.cmd = 'SELECT'
  ),
  'owner SELECT policy on audit'
);

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_audit', 'INSERT')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_audit', 'UPDATE')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_audit', 'DELETE'),
  'authenticated cannot mutate audit rows'
);

select ok(
  has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_audit', 'SELECT'),
  'authenticated retains SELECT on audit'
);

select finish();

rollback;
