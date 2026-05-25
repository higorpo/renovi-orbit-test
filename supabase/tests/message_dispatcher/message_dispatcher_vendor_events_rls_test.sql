-- pgTAP: message_dispatcher_vendor_events RLS and access (design §3.8).

begin;

select plan(5);

select ok(
  c.relrowsecurity,
  'message_dispatcher_vendor_events has RLS enabled'
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'message_dispatcher'
  and c.relname = 'message_dispatcher_vendor_events';

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_vendor_events', 'SELECT')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_vendor_events', 'INSERT')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_vendor_events', 'UPDATE')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_vendor_events', 'DELETE'),
  'authenticated has no privileges on vendor_events'
);

select ok(
  not has_table_privilege('anon', 'message_dispatcher.message_dispatcher_vendor_events', 'SELECT')
  and not has_table_privilege('anon', 'message_dispatcher.message_dispatcher_vendor_events', 'INSERT'),
  'anon has no privileges on vendor_events'
);

select ok(
  not has_table_privilege('public', 'message_dispatcher.message_dispatcher_vendor_events', 'SELECT')
  and not has_table_privilege('public', 'message_dispatcher.message_dispatcher_vendor_events', 'INSERT'),
  'public has no privileges on vendor_events'
);

select ok(
  has_table_privilege('service_role', 'message_dispatcher.message_dispatcher_vendor_events', 'SELECT')
  and has_table_privilege('service_role', 'message_dispatcher.message_dispatcher_vendor_events', 'INSERT'),
  'service_role retains SELECT and INSERT on vendor_events'
);

select finish();

rollback;
