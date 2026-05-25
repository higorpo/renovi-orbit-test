-- pgTAP: ingest blocks 21st push in 24h window (task 25, Req.1 AC1).

begin;

select plan(3);

create temp table _push_quota_fixture as
select p.id as profile_id, gen_random_uuid() as twenty_first_key
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _push_quota_fixture
on conflict (profile_id) do nothing;

insert into message_dispatcher.message_dispatches (
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  created_at
)
select
  gen_random_uuid(),
  f.profile_id,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _push_quota_fixture f,
  generate_series(1, 20) g;

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select twenty_first_key from _push_quota_fixture),
      (select profile_id from _push_quota_fixture),
      'push'::message_dispatcher.message_channel,
      'engagement_push'
    )->>'status'
  ),
  'FAILED_TERMINAL',
  '21st push ingest is terminal'
);

select is(
  (
    select failure_code
    from message_dispatcher.message_dispatches d
    join _push_quota_fixture f on d.idempotency_key = f.twenty_first_key
  ),
  'push_daily_quota_exceeded',
  'failure_code set'
);

select ok(
  (
    select (d.metadata -> 'rate_limit' ->> 'limit')::int
    from message_dispatcher.message_dispatches d
    join _push_quota_fixture f on d.idempotency_key = f.twenty_first_key
  ) = 20,
  'metadata.rate_limit records limit'
);

select finish();

rollback;
