-- pgTAP: bypass_limits dispatches do not count toward 24h email/push quota (design §5.1).

begin;

select plan(5);

create temp table _bypass_quota_count_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as normal_email_key,
  gen_random_uuid() as normal_push_key
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _bypass_quota_count_fixture
on conflict (profile_id) do nothing;

-- Seed 5 bypass email dispatches (would block normal ingest if counted)
insert into message_dispatcher.message_dispatches (
  idempotency_key, profile_id, channel, template_key, status, bypass_limits, created_at
)
select
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  true,
  now()
from _bypass_quota_count_fixture f,
  generate_series(1, 5) g;

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select normal_email_key from _bypass_quota_count_fixture),
      (select profile_id from _bypass_quota_count_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template'
    )->>'status'
  ),
  'QUEUED',
  'normal email ingest succeeds when only bypass dispatches fill window'
);

-- Seed 20 bypass push dispatches (would block normal ingest if counted)
insert into message_dispatcher.message_dispatches (
  idempotency_key, profile_id, channel, template_key, status, bypass_limits, created_at
)
select
  gen_random_uuid(),
  f.profile_id,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  true,
  now()
from _bypass_quota_count_fixture f,
  generate_series(1, 20) g;

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select normal_push_key from _bypass_quota_count_fixture),
      (select profile_id from _bypass_quota_count_fixture),
      'push'::message_dispatcher.message_channel,
      'engagement_push'
    )->>'status'
  ),
  'QUEUED',
  'normal push ingest succeeds when only bypass dispatches fill window'
);

-- PENDING_EVALUATION over bypass-only window must not terminal on quota
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status, bypass_limits, created_at
)
select
  gen_random_uuid(),
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'PENDING_EVALUATION'::message_dispatcher.message_dispatch_status,
  false,
  now()
from _bypass_quota_count_fixture f;

select is(
  (
    select count(*)::integer
    from message_dispatcher.message_dispatches d
    join _bypass_quota_count_fixture f on d.profile_id = f.profile_id
    where d.status = 'PENDING_EVALUATION'
      and d.channel = 'email'
      and d.bypass_limits = false
  ),
  1,
  'fixture has one non-bypass pending email dispatch'
);

select message_dispatcher.message_dispatcher_evaluate_pending();

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _bypass_quota_count_fixture f on d.profile_id = f.profile_id
    where d.status = 'PENDING_EVALUATION'
      and d.channel = 'email'
      and d.bypass_limits = false
  ),
  null,
  'evaluate_pending promotes non-bypass email when quota window is bypass-only'
);

select ok(
  (
    select count(*)::integer >= 1
    from message_dispatcher.message_dispatches d
    join _bypass_quota_count_fixture f on d.profile_id = f.profile_id
    where d.channel = 'email'
      and d.bypass_limits = false
      and d.status = 'QUEUED'
  ),
  'non-bypass email dispatch reached QUEUED after evaluate_pending'
);

select * from finish();

rollback;
