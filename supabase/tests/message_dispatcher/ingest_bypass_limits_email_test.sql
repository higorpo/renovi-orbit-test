-- pgTAP: bypass_limits skips email daily quota at ingest (design §5.1).

begin;

select plan(4);

create temp table _bypass_email_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as bypass_key,
  gen_random_uuid() as normal_key
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _bypass_email_fixture
on conflict (profile_id) do nothing;

-- Seed 5 email dispatches (at the default daily limit)
insert into message_dispatcher.message_dispatches (
  idempotency_key, profile_id, channel, template_key, status, created_at
)
select
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _bypass_email_fixture f,
  generate_series(1, 5) g;

-- Ingest with bypass_limits=true should succeed (QUEUED)
select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select bypass_key from _bypass_email_fixture),
      (select profile_id from _bypass_email_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      '{}'::jsonb,
      now(),
      'orbit',
      '{}'::jsonb,
      true
    )->>'status'
  ),
  'QUEUED',
  'bypass_limits=true skips email quota → QUEUED'
);

select ok(
  (
    select d.bypass_limits
    from message_dispatcher.message_dispatches d
    join _bypass_email_fixture f on d.idempotency_key = f.bypass_key
  ),
  'bypass_limits column persisted as true'
);

-- Normal ingest without bypass should fail quota
select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select normal_key from _bypass_email_fixture),
      (select profile_id from _bypass_email_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template'
    )->>'status'
  ),
  'FAILED_TERMINAL',
  'normal ingest without bypass is terminal'
);

select is(
  (
    select d.failure_code
    from message_dispatcher.message_dispatches d
    join _bypass_email_fixture f on d.idempotency_key = f.normal_key
  ),
  'email_daily_quota_exceeded',
  'normal ingest failure_code is email_daily_quota_exceeded'
);

select * from finish();

rollback;
