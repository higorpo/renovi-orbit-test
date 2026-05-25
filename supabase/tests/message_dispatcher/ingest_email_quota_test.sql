-- pgTAP: ingest blocks 6th email in 24h window (task 24, Req.1 AC1).

begin;

select plan(3);

create temp table _email_quota_fixture as
select p.id as profile_id, gen_random_uuid() as sixth_key
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _email_quota_fixture
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
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _email_quota_fixture f,
  generate_series(1, 5) g;

select is(
  (
    select (message_dispatcher.message_dispatcher_ingest(
      (select sixth_key from _email_quota_fixture),
      (select profile_id from _email_quota_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template'
    )->>'status')
  ),
  'FAILED_TERMINAL',
  '6th email ingest is terminal'
);

select is(
  (
    select failure_code
    from message_dispatcher.message_dispatches d
    join _email_quota_fixture f on d.idempotency_key = f.sixth_key
  ),
  'email_daily_quota_exceeded',
  'failure_code set'
);

select ok(
  (
    select (d.metadata -> 'rate_limit' ->> 'limit')::int
    from message_dispatcher.message_dispatches d
    join _email_quota_fixture f on d.idempotency_key = f.sixth_key
  ) = 5,
  'metadata.rate_limit records limit'
);

select finish();

rollback;
