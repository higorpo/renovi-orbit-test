-- pgTAP: serialized push ingests — one quota slot left, one success (task 104, Req.1 AC3).

begin;

\ir ../rls/fixtures/seed_rls_actors.inc
\ir fixtures/seed_mmd_isolated_profile.inc

select plan(5);

create temp table _quota_race_fixture as
select
  pg_temp.mmd_isolated_profile('c1111111-1111-4111-8111-111111111004'::uuid) as profile_id,
  gen_random_uuid() as ingest_key_a,
  gen_random_uuid() as ingest_key_b;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _quota_race_fixture
on conflict (profile_id) do nothing;

-- 19 active push rows → one slot remains under default limit 20.
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
from _quota_race_fixture f,
  generate_series(1, 19) g;

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select ingest_key_a from _quota_race_fixture),
      (select profile_id from _quota_race_fixture),
      'push'::message_dispatcher.message_channel,
      'engagement_push'
    )->>'status'
  ),
  'QUEUED',
  'first ingest wins the last quota slot (FOR UPDATE ordering)'
);

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select ingest_key_b from _quota_race_fixture),
      (select profile_id from _quota_race_fixture),
      'push'::message_dispatcher.message_channel,
      'engagement_push'
    )->>'status'
  ),
  'FAILED_TERMINAL',
  'second ingest hits push_daily_quota_exceeded'
);

select is(
  (
    select count(*)::integer
    from message_dispatcher.message_dispatches d
    join _quota_race_fixture f on d.profile_id = f.profile_id
    where d.channel = 'push'
      and d.status in ('DELIVERED', 'QUEUED', 'PROCESSING', 'SCHEDULED')
      and d.created_at > now() - interval '24 hours'
  ),
  20,
  'exactly 20 active push rows after race (not 21)'
);

select is(
  (
    select failure_code
    from message_dispatcher.message_dispatches d
    join _quota_race_fixture f on d.idempotency_key = f.ingest_key_b
  ),
  'push_daily_quota_exceeded',
  'loser ingest records quota failure_code'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatcher_user_limits ul
    join _quota_race_fixture f on ul.profile_id = f.profile_id
  ),
  'user_limits row exists (FOR UPDATE anchor)'
);

select finish();

rollback;
