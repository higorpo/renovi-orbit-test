-- pgTAP: push DELIVERED updates user_limits (last_push_sent_at, push_count_24h).

begin;

\ir ../rls/fixtures/seed_rls_actors.inc
\ir fixtures/seed_mmd_isolated_profile.inc

select plan(3);

create temp table _push_limits_fixture as
select
  pg_temp.mmd_isolated_profile('c1111111-1111-4111-8111-111111111001'::uuid) as profile_id,
  gen_random_uuid() as dispatch_id;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  scheduled_for,
  locked_by,
  locked_until
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now(),
  'worker-push-limits',
  now() + interval '30 seconds'
from _push_limits_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _push_limits_fixture),
      'worker-push-limits',
      'push'::message_dispatcher.message_channel,
      true,
      null,
      200,
      null,
      null,
      '[]'::jsonb
    )->>'applied'
  ),
  'true',
  'push report success applies'
);

select ok(
  (
    select ul.last_push_sent_at is not null
    from message_dispatcher.message_dispatcher_user_limits ul
    join _push_limits_fixture f on ul.profile_id = f.profile_id
  ),
  'last_push_sent_at set on DELIVERED'
);

select is(
  (
    select ul.push_count_24h
    from message_dispatcher.message_dispatcher_user_limits ul
    join _push_limits_fixture f on ul.profile_id = f.profile_id
  ),
  1,
  'push_count_24h incremented on DELIVERED'
);

select finish();

rollback;
