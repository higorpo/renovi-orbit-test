-- pgTAP: explicit REVOKE on message_dispatches DML (design §3.8, task 95).

begin;

select plan(4);

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_dispatches', 'INSERT')
    and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatches', 'UPDATE')
    and not has_table_privilege('authenticated', 'message_dispatcher.message_dispatches', 'DELETE'),
  'authenticated cannot INSERT UPDATE DELETE message_dispatches'
);

select ok(
  not has_table_privilege('anon', 'message_dispatcher.message_dispatches', 'INSERT')
    and not has_table_privilege('anon', 'message_dispatcher.message_dispatches', 'UPDATE')
    and not has_table_privilege('anon', 'message_dispatcher.message_dispatches', 'DELETE'),
  'anon cannot INSERT UPDATE DELETE message_dispatches'
);

select ok(
  not has_table_privilege('public', 'message_dispatcher.message_dispatches', 'INSERT')
    and not has_table_privilege('public', 'message_dispatcher.message_dispatches', 'UPDATE')
    and not has_table_privilege('public', 'message_dispatcher.message_dispatches', 'DELETE'),
  'public cannot INSERT UPDATE DELETE message_dispatches'
);

select ok(
  has_table_privilege('service_role', 'message_dispatcher.message_dispatches', 'INSERT')
    and has_table_privilege('service_role', 'message_dispatcher.message_dispatches', 'UPDATE'),
  'service_role retains DML for SECURITY DEFINER RPC paths'
);

select finish();

rollback;
