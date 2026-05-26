-- pgTAP: bypass_limits skips push daily quota and push cooldown at ingest (design §5.1).

begin;

select plan(4);

create temp table _bypass_push_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as bypass_quota_key,
  gen_random_uuid() as bypass_cooldown_key,
  now() - interval '5 minutes' as last_sent
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (
  profile_id, last_push_sent_at
)
select profile_id, last_sent
from _bypass_push_fixture
on conflict (profile_id) do update
  set last_push_sent_at = excluded.last_push_sent_at;

-- Seed 20 push dispatches (at the default daily limit)
insert into message_dispatcher.message_dispatches (
  idempotency_key, profile_id, channel, template_key, status, created_at
)
select
  gen_random_uuid(),
  f.profile_id,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _bypass_push_fixture f,
  generate_series(1, 20) g;

-- Scenario 1: bypass_limits=true skips push daily quota
select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select bypass_quota_key from _bypass_push_fixture),
      (select profile_id from _bypass_push_fixture),
      'push'::message_dispatcher.message_channel,
      'engagement_push',
      '{}'::jsonb,
      now(),
      'orbit',
      '{}'::jsonb,
      true
    )->>'status'
  ),
  'QUEUED',
  'bypass_limits=true skips push quota → QUEUED'
);

select ok(
  (
    select d.bypass_limits
    from message_dispatcher.message_dispatches d
    join _bypass_push_fixture f on d.idempotency_key = f.bypass_quota_key
  ),
  'bypass_limits column persisted as true on quota-bypass dispatch'
);

-- Scenario 2: bypass_limits=true skips push cooldown
-- (last_push_sent_at is 5 minutes ago, within the 10-minute cooldown)
select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select bypass_cooldown_key from _bypass_push_fixture),
      (select profile_id from _bypass_push_fixture),
      'push'::message_dispatcher.message_channel,
      'engagement_push',
      '{}'::jsonb,
      now(),
      'orbit',
      '{}'::jsonb,
      true
    )->>'status'
  ),
  'QUEUED',
  'bypass_limits=true skips push cooldown → QUEUED (not SCHEDULED)'
);

select isnt(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _bypass_push_fixture f on d.idempotency_key = f.bypass_cooldown_key
  ),
  'SCHEDULED',
  'bypass cooldown dispatch is not SCHEDULED'
);

select * from finish();

rollback;
