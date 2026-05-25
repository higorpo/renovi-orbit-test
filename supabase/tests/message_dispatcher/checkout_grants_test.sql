-- pgTAP: checkout_batch EXECUTE limited to service_role (design §11.1, task 51).

begin;

select plan(4);

select ok(
  has_function_privilege(
    'service_role',
    'message_dispatcher.message_dispatcher_checkout_batch(integer,text)',
    'EXECUTE'
  ),
  'service_role can EXECUTE checkout_batch'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'message_dispatcher.message_dispatcher_checkout_batch(integer,text)',
    'EXECUTE'
  ),
  'authenticated cannot EXECUTE checkout_batch'
);

select ok(
  not has_function_privilege(
    'anon',
    'message_dispatcher.message_dispatcher_checkout_batch(integer,text)',
    'EXECUTE'
  ),
  'anon cannot EXECUTE checkout_batch'
);

select ok(
  not has_function_privilege(
    'public',
    'message_dispatcher.message_dispatcher_checkout_batch(integer,text)',
    'EXECUTE'
  ),
  'public cannot EXECUTE checkout_batch'
);

select finish();

rollback;
