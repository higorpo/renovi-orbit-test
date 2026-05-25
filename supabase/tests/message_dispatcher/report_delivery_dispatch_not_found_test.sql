-- pgTAP: report_delivery_outcome with non-existent dispatch_id returns dispatch_not_found.

begin;

select plan(2);

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      gen_random_uuid(),
      'worker-ghost',
      'email'::message_dispatcher.message_channel,
      true,
      're_should_not_apply',
      200
    )->>'reason'
  ),
  'dispatch_not_found',
  'non-existent dispatch_id returns dispatch_not_found'
);

select is(
  (
    select (message_dispatcher.message_dispatcher_report_delivery_outcome(
      gen_random_uuid(),
      'worker-ghost-2',
      'email'::message_dispatcher.message_channel,
      false,
      null,
      500,
      'server_error',
      'test',
      '[]'::jsonb,
      true
    )->>'applied')::boolean
  ),
  false,
  'applied is false for non-existent dispatch'
);

select finish();

rollback;
