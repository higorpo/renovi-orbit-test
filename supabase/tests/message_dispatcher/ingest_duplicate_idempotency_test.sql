-- pgTAP: ingest duplicate idempotency replay (design §5.1, task 22, Req.5 AC1).

begin;

select plan(3);

create temp table _ingest_dup_fixture as
select
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid as idempotency_key,
  p.id as profile_id
from public.profiles p
limit 1;

select ok(
  (select count(*) from _ingest_dup_fixture) = 1,
  'fixture profile exists'
);

insert into message_dispatcher.message_dispatches (
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  scheduled_for
)
select
  f.idempotency_key,
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  '2026-05-22T12:00:00Z'::timestamptz
from _ingest_dup_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      f.idempotency_key,
      f.profile_id,
      'email'::message_dispatcher.message_channel,
      'welcome_template'
    )->>'duplicate'
    from _ingest_dup_fixture f
  ),
  'true',
  'duplicate flag true on replay'
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches d
    join _ingest_dup_fixture f on f.idempotency_key = d.idempotency_key
  ),
  1,
  'no second row inserted'
);

select finish();

rollback;
