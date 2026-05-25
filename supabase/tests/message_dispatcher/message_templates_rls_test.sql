-- pgTAP: message_templates RLS (design §3.8, task 16).

begin;

select plan(4);

select ok(
  c.relrowsecurity,
  'message_templates has RLS enabled'
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'message_dispatcher'
  and c.relname = 'message_templates';

select ok(
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'message_dispatcher'
      and p.tablename = 'message_templates'
      and p.policyname = 'message_templates_select_authenticated'
      and p.cmd = 'SELECT'
      and p.roles = array['authenticated']::name[]
  ),
  'authenticated read-only SELECT policy'
);

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_templates', 'INSERT')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_templates', 'UPDATE')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_templates', 'DELETE'),
  'authenticated cannot write templates'
);

select ok(
  has_table_privilege('authenticated', 'message_dispatcher.message_templates', 'SELECT'),
  'authenticated can SELECT templates'
);

select finish();

rollback;
