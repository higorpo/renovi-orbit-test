-- pgTAP: quiet hours in evaluate_pending — helper consistency and push cooldown quiet hours path.

begin;

select plan(5);

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
select
  profile_id,
  timezone(
    'America/Sao_Paulo',
    date_trunc('day', timezone('America/Sao_Paulo', now()) + interval '1 day') + interval '21 hours 55 minutes'
  )
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

select ok(
  (
    select d.status::text = 'SCHEDULED'
      and d.bypass_limits
      and d.scheduled_for = message_dispatcher.message_dispatcher_next_send_window(
        (select last_push_sent_at from message_dispatcher.message_dispatcher_user_limits u
         join _eval_fixture f on u.profile_id = f.profile_id)
        + make_interval(mins => 10)
      )
    from message_dispatcher.message_dispatches d
    join _eval_fixture f on d.idempotency_key = f.dispatch_key
  ),
  'evaluate_pending reschedules push cooldown that falls in quiet hours'
);

select * from finish();
rollback;
