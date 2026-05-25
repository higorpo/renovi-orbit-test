-- pgTAP: message_dispatcher_user_limits RLS (design §3.8).

begin;

select plan(4);

select ok(
  c.relrowsecurity,
  'message_dispatcher_user_limits has RLS enabled'
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'message_dispatcher'
  and c.relname = 'message_dispatcher_user_limits';

select ok(
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'message_dispatcher'
      and p.tablename = 'message_dispatcher_user_limits'
      and p.policyname = 'message_dispatcher_user_limits_select_owner'
      and p.cmd = 'SELECT'
      and p.roles = array['authenticated']::name[]
  ),
  'owner SELECT policy for authenticated'
);

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_user_limits', 'INSERT')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_user_limits', 'UPDATE')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_user_limits', 'DELETE'),
  'authenticated cannot INSERT UPDATE DELETE user_limits'
);

select ok(
  has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_user_limits', 'SELECT'),
  'authenticated retains SELECT (scoped by RLS)'
);

select finish();

rollback;
