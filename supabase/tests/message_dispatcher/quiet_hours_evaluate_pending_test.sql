-- pgTAP: quiet hours in evaluate_pending — helper consistency and push cooldown quiet hours path.

begin;

select plan(7);

-- Verify helper consistency: is_quiet_hours agrees with next_send_window semantics

select ok(
  message_dispatcher.message_dispatcher_is_quiet_hours('2026-06-15 23:00:00-03'::timestamptz),
  'is_quiet_hours true at 23:00 BRT (used by evaluate_pending)'
);

select ok(
  not message_dispatcher.message_dispatcher_is_quiet_hours(
    message_dispatcher.message_dispatcher_next_send_window('2026-06-15 23:00:00-03'::timestamptz)
  ),
  'next_send_window result is NOT in quiet hours (06:00 BRT is outside)'
);

select ok(
  message_dispatcher.message_dispatcher_next_send_window('2026-06-15 23:00:00-03'::timestamptz)
    > '2026-06-15 23:00:00-03'::timestamptz,
  'next_send_window is always in the future relative to a quiet hours timestamp'
);

-- Push cooldown quiet hours reschedule path in evaluate_pending:
-- Insert a PENDING_EVALUATION dispatch with push cooldown that falls in quiet hours.

create temp table _eval_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as dispatch_key
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id, last_push_sent_at)
select profile_id, '2026-06-15 21:55:00-03'::timestamptz
from _eval_fixture
on conflict (profile_id) do update
  set last_push_sent_at = excluded.last_push_sent_at;

insert into message_dispatcher.message_dispatches (
  idempotency_key,
  profile_id,
  channel,
  template_key,
  template_variables,
  status,
  scheduled_for,
  source_system,
  metadata,
  bypass_limits
)
select
  dispatch_key,
  profile_id,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  '{}'::jsonb,
  'PENDING_EVALUATION'::message_dispatcher.message_dispatch_status,
  now(),
  'orbit',
  '{}'::jsonb,
  false
from _eval_fixture;

-- The cooldown_until = 21:55 + 10min = 22:05 BRT → in quiet hours → should reschedule to 06:00

select lives_ok(
  'select message_dispatcher.message_dispatcher_evaluate_pending()',
  'evaluate_pending runs without error'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _eval_fixture f on d.idempotency_key = f.dispatch_key
  ),
  'SCHEDULED',
  'dispatch rescheduled to SCHEDULED due to push cooldown falling in quiet hours'
);

select is(
  (
    select d.scheduled_for
    from message_dispatcher.message_dispatches d
    join _eval_fixture f on d.idempotency_key = f.dispatch_key
  ),
  '2026-06-16 06:00:00-03'::timestamptz,
  'scheduled_for deferred to 06:00 next day BRT by evaluate_pending quiet hours'
);

select is(
  (
    select d.bypass_limits
    from message_dispatcher.message_dispatches d
    join _eval_fixture f on d.idempotency_key = f.dispatch_key
  ),
  true,
  'bypass_limits set to true by evaluate_pending quiet hours reschedule'
);

select * from finish();
rollback;
