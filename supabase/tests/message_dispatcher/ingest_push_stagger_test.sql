-- pgTAP: bulk push ingests stagger scheduled_for (cooldown queue tail).

begin;

select plan(5);

create temp table _stagger_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as key_a,
  gen_random_uuid() as key_b,
  gen_random_uuid() as key_c
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _stagger_fixture
on conflict (profile_id) do nothing;

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select key_a from _stagger_fixture),
      (select profile_id from _stagger_fixture),
      'push'::message_dispatcher.message_channel,
      'engagement_push'
    )->>'status'
  ),
  'QUEUED',
  'first push ingest is immediately QUEUED when no pending tail'
);

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select key_b from _stagger_fixture),
      (select profile_id from _stagger_fixture),
      'push'::message_dispatcher.message_channel,
      'engagement_push'
    )->>'status'
  ),
  'SCHEDULED',
  'second push ingest is deferred when first is still pending'
);

select ok(
  (
    select d_b.scheduled_for > d_a.scheduled_for
    from message_dispatcher.message_dispatches d_a
    join message_dispatcher.message_dispatches d_b
      on d_b.idempotency_key = (select key_b from _stagger_fixture)
    where d_a.idempotency_key = (select key_a from _stagger_fixture)
  ),
  'second push scheduled_for is after the first'
);

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select key_c from _stagger_fixture),
      (select profile_id from _stagger_fixture),
      'push'::message_dispatcher.message_channel,
      'engagement_push'
    )->>'status'
  ),
  'SCHEDULED',
  'third push ingest is also deferred'
);

select ok(
  (
    select count(distinct d.scheduled_for)::int = 3
    from message_dispatcher.message_dispatches d
    join _stagger_fixture f on d.profile_id = f.profile_id
    where d.idempotency_key in (f.key_a, f.key_b, f.key_c)
  ),
  'three ingests receive distinct staggered scheduled_for values'
);

select finish();

rollback;
