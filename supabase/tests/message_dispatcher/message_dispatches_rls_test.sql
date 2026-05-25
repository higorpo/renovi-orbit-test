-- pgTAP: message_dispatches RLS and grants (design §3.8, task 13).

begin;

select plan(4);

select ok(
  c.relrowsecurity,
  'message_dispatches has RLS enabled'
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'message_dispatcher'
  and c.relname = 'message_dispatches';

select ok(
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'message_dispatcher'
      and p.tablename = 'message_dispatches'
      and p.policyname = 'message_dispatches_select_owner'
      and p.cmd = 'SELECT'
      and p.roles = array['authenticated']::name[]
  ),
  'owner SELECT policy for authenticated'
);

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_dispatches', 'INSERT')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatches', 'UPDATE')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatches', 'DELETE'),
  'authenticated cannot INSERT UPDATE DELETE message_dispatches'
);

select ok(
  has_table_privilege('authenticated', 'message_dispatcher.message_dispatches', 'SELECT'),
  'authenticated retains SELECT (scoped by RLS)'
);

select finish();

rollback;
