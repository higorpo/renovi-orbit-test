-- pgTAP: quiet hours reschedule in ingest (scheduled_for in quiet window → deferred to 06:00 BRT).

begin;

select plan(8);

create temp table _qh_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as key_night,
  gen_random_uuid() as key_early,
  gen_random_uuid() as key_day
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _qh_fixture
on conflict (profile_id) do nothing;

-- Case 1: scheduled_for at 23:00 BRT → should reschedule to 06:00 next day BRT
select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select key_night from _qh_fixture),
      (select profile_id from _qh_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      '{}'::jsonb,
      '2026-06-15 23:00:00-03'::timestamptz
    )->>'status'
  ),
  'SCHEDULED',
  'ingest at 23:00 BRT yields SCHEDULED'
);

select is(
  (
    select d.scheduled_for
    from message_dispatcher.message_dispatches d
    join _qh_fixture f on d.idempotency_key = f.key_night
  ),
  '2026-06-16 06:00:00-03'::timestamptz,
  'scheduled_for is deferred to 06:00 next day BRT'
);

select is(
  (
    select d.bypass_limits
    from message_dispatcher.message_dispatches d
    join _qh_fixture f on d.idempotency_key = f.key_night
  ),
  true,
  'bypass_limits is true when rescheduled due to quiet hours'
);

-- Case 2: scheduled_for at 03:00 BRT → should reschedule to 06:00 same day BRT
select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select key_early from _qh_fixture),
      (select profile_id from _qh_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      '{}'::jsonb,
      '2026-06-16 03:00:00-03'::timestamptz
    )->>'status'
  ),
  'SCHEDULED',
  'ingest at 03:00 BRT yields SCHEDULED'
);

select is(
  (
    select d.scheduled_for
    from message_dispatcher.message_dispatches d
    join _qh_fixture f on d.idempotency_key = f.key_early
  ),
  '2026-06-16 06:00:00-03'::timestamptz,
  'scheduled_for at 03:00 BRT deferred to 06:00 same day BRT'
);

select is(
  (
    select d.bypass_limits
    from message_dispatcher.message_dispatches d
    join _qh_fixture f on d.idempotency_key = f.key_early
  ),
  true,
  'bypass_limits is true for 03:00 BRT reschedule'
);

-- Case 3: scheduled_for at 10:00 BRT → no reschedule, normal behavior
select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select key_day from _qh_fixture),
      (select profile_id from _qh_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      '{}'::jsonb,
      '2026-06-15 10:00:00-03'::timestamptz
    )->>'status'
  ),
  'QUEUED',
  'ingest at 10:00 BRT (future) yields QUEUED as normal'
);

select is(
  (
    select d.bypass_limits
    from message_dispatcher.message_dispatches d
    join _qh_fixture f on d.idempotency_key = f.key_day
  ),
  false,
  'bypass_limits is false when NOT rescheduled by quiet hours'
);

select * from finish();
rollback;
