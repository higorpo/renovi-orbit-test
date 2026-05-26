-- pgTAP: push cooldown defers to SCHEDULED (design §6.1, task 26, Req.1 AC2).

begin;

select plan(3);

create temp table _cooldown_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as ingest_key,
  now() - interval '5 minutes' as last_sent
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (
  profile_id,
  last_push_sent_at
)
select profile_id, last_sent
from _cooldown_fixture
on conflict (profile_id) do update
  set last_push_sent_at = excluded.last_push_sent_at;

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select ingest_key from _cooldown_fixture),
      (select profile_id from _cooldown_fixture),
      'push'::message_dispatcher.message_channel,
      'engagement_push'
    )->>'status'
  ),
  'SCHEDULED',
  'cooldown violation yields SCHEDULED not terminal'
);

select is(
  (
    select d.scheduled_for
    from message_dispatcher.message_dispatches d
    join _cooldown_fixture f on d.idempotency_key = f.ingest_key
  ),
  (
    select f.last_sent + interval '10 minutes'
    from _cooldown_fixture f
  ),
  'scheduled_for is last_push_sent_at + 10 minutes'
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches d
    join _cooldown_fixture f on d.profile_id = f.profile_id and d.channel = 'push'
  ),
  1,
  'single deferred dispatch inserted'
);

select finish();

rollback;
