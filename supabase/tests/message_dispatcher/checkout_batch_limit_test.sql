-- pgTAP: checkout_batch p_limit bounds 1..50 (design §5.5, task 107).

begin;

select plan(3);

select throws_ok(
  $$select message_dispatcher.message_dispatcher_checkout_batch(0, 'worker-limit')$$,
  '22023',
  null,
  'p_limit 0 rejected'
);

select throws_ok(
  $$select message_dispatcher.message_dispatcher_checkout_batch(51, 'worker-limit')$$,
  '22023',
  null,
  'p_limit above 50 rejected'
);

select lives_ok(
  $$select message_dispatcher.message_dispatcher_checkout_batch(25, 'worker-limit')$$,
  'p_limit 25 accepted'
);

select finish();

rollback;
