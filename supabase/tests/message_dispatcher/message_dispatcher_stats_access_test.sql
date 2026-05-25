-- pgTAP: message_dispatcher_stats access control (design §10.2, task 83).

begin;

select plan(4);

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_stats', 'SELECT')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_stats', 'INSERT')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_stats', 'UPDATE')
  and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatcher_stats', 'DELETE'),
  'authenticated has no privileges on stats'
);

select ok(
  not has_table_privilege('public', 'message_dispatcher.message_dispatcher_stats', 'SELECT')
  and not has_table_privilege('public', 'message_dispatcher.message_dispatcher_stats', 'INSERT'),
  'public has no privileges on stats'
);

select ok(
  not has_table_privilege('anon', 'message_dispatcher.message_dispatcher_stats', 'SELECT')
  and not has_table_privilege('anon', 'message_dispatcher.message_dispatcher_stats', 'INSERT'),
  'anon has no privileges on stats'
);

select ok(
  has_table_privilege('service_role', 'message_dispatcher.message_dispatcher_stats', 'SELECT'),
  'service_role can SELECT stats'
);

select finish();

rollback;
