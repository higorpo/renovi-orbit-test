-- pgTAP: quiet hours helper functions (is_quiet_hours + next_send_window).

begin;

select plan(13);

-- is_quiet_hours: boundary and interior tests with explicit BRT timestamps

select is(
  message_dispatcher.message_dispatcher_is_quiet_hours('2026-06-15 21:59:00-03'::timestamptz),
  false,
  '21:59 BRT is NOT quiet hours'
);

select is(
  message_dispatcher.message_dispatcher_is_quiet_hours('2026-06-15 22:00:00-03'::timestamptz),
  true,
  '22:00 BRT IS quiet hours'
);

select is(
  message_dispatcher.message_dispatcher_is_quiet_hours('2026-06-15 23:30:00-03'::timestamptz),
  true,
  '23:30 BRT IS quiet hours'
);

select is(
  message_dispatcher.message_dispatcher_is_quiet_hours('2026-06-16 00:00:00-03'::timestamptz),
  true,
  '00:00 BRT IS quiet hours'
);

select is(
  message_dispatcher.message_dispatcher_is_quiet_hours('2026-06-16 05:59:00-03'::timestamptz),
  true,
  '05:59 BRT IS quiet hours'
);

select is(
  message_dispatcher.message_dispatcher_is_quiet_hours('2026-06-16 06:00:00-03'::timestamptz),
  false,
  '06:00 BRT is NOT quiet hours'
);

select is(
  message_dispatcher.message_dispatcher_is_quiet_hours('2026-06-15 12:00:00-03'::timestamptz),
  false,
  '12:00 BRT is NOT quiet hours'
);

-- next_send_window: returns correct 06:00 BRT

select is(
  message_dispatcher.message_dispatcher_next_send_window('2026-06-15 23:00:00-03'::timestamptz),
  '2026-06-16 06:00:00-03'::timestamptz,
  '23:00 BRT → next send window is 06:00 next day BRT'
);

select is(
  message_dispatcher.message_dispatcher_next_send_window('2026-06-16 03:00:00-03'::timestamptz),
  '2026-06-16 06:00:00-03'::timestamptz,
  '03:00 BRT → next send window is 06:00 same day BRT'
);

select is(
  message_dispatcher.message_dispatcher_next_send_window('2026-06-15 10:00:00-03'::timestamptz),
  '2026-06-16 06:00:00-03'::timestamptz,
  '10:00 BRT (outside quiet hours) → next send window is 06:00 next day BRT'
);

select is(
  message_dispatcher.message_dispatcher_next_send_window('2026-06-15 22:00:00-03'::timestamptz),
  '2026-06-16 06:00:00-03'::timestamptz,
  '22:00 BRT → next send window is 06:00 next day BRT'
);

select is(
  message_dispatcher.message_dispatcher_next_send_window('2026-06-16 00:00:00-03'::timestamptz),
  '2026-06-16 06:00:00-03'::timestamptz,
  '00:00 BRT → next send window is 06:00 same day BRT'
);

select is(
  message_dispatcher.message_dispatcher_next_send_window('2026-06-16 05:59:00-03'::timestamptz),
  '2026-06-16 06:00:00-03'::timestamptz,
  '05:59 BRT → next send window is 06:00 same day BRT'
);

select * from finish();
rollback;
