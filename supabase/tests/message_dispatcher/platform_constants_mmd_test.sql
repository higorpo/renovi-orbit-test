-- pgTAP: MMD platform_constants seeds (design Appendix B, task 17).

begin;

select plan(7);

select is(
  (select (value #>> '{}')::int from public.platform_constants where key = 'message_dispatcher.email_daily_limit'),
  5,
  'email_daily_limit'
);

select is(
  (select (value #>> '{}')::int from public.platform_constants where key = 'message_dispatcher.push_daily_limit'),
  20,
  'push_daily_limit'
);

select is(
  (select (value #>> '{}')::int from public.platform_constants where key = 'message_dispatcher.push_cooldown_minutes'),
  20,
  'push_cooldown_minutes'
);

select is(
  (select (value #>> '{}')::int from public.platform_constants where key = 'message_dispatcher.lease_seconds'),
  30,
  'lease_seconds'
);

select is(
  (select (value #>> '{}')::int from public.platform_constants where key = 'message_dispatcher.max_retries'),
  3,
  'max_retries'
);

select is(
  (select (value #>> '{}')::int from public.platform_constants where key = 'message_dispatcher.checkout_batch_size'),
  25,
  'checkout_batch_size'
);

select is(
  (select (value #>> '{}')::int from public.platform_constants where key = 'message_dispatcher.backoff_base_seconds'),
  60,
  'backoff_base_seconds'
);

select finish();

rollback;
