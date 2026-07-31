-- pgTAP: message_templates RLS — service_role only (no client SELECT).

begin;

select plan(5);

select ok(
  c.relrowsecurity,
  'message_templates has RLS enabled'
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'message_dispatcher'
  and c.relname = 'message_templates';

select ok(
  not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'message_dispatcher'
      and p.tablename = 'message_templates'
  ),
  'message_templates has no client RLS policies'
);

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_templates', 'INSERT')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_templates', 'UPDATE')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_templates', 'DELETE'),
  'authenticated cannot write templates'
);

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_templates', 'SELECT'),
  'authenticated cannot SELECT templates'
);

select ok(
  has_table_privilege('service_role', 'message_dispatcher.message_templates', 'SELECT'),
  'service_role can SELECT templates'
);

select finish();

rollback;
