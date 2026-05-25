-- pgTAP: concurrent-safe duplicate ingest (design §4.10, task 100, Req.5 AC1).

begin;

select plan(6);

create temp table _parallel_ingest_fixture as
select
  gen_random_uuid() as idempotency_key,
  p.id as profile_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _parallel_ingest_fixture
on conflict (profile_id) do nothing;

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'message_dispatcher'
      and t.relname = 'message_dispatches'
      and c.conname = 'message_dispatches_idempotency_key_unique'
  ),
  'idempotency_key UNIQUE constraint exists'
);

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      f.idempotency_key,
      f.profile_id,
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      jsonb_build_object('name', 'first')
    )->>'duplicate'
    from _parallel_ingest_fixture f
  ),
  'false',
  'first ingest creates dispatch'
);

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      f.idempotency_key,
      f.profile_id,
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      jsonb_build_object('name', 'second_payload_must_not_apply')
    )->>'duplicate'
    from _parallel_ingest_fixture f
  ),
  'true',
  'immediate replay returns duplicate without second row'
);

select is(
  (
    select count(*)::integer
    from message_dispatcher.message_dispatches d
    join _parallel_ingest_fixture f on d.idempotency_key = f.idempotency_key
  ),
  1,
  'only one dispatch row for idempotency_key'
);

select is(
  (
    select d.template_variables->>'name'
    from message_dispatcher.message_dispatches d
    join _parallel_ingest_fixture f on d.idempotency_key = f.idempotency_key
  ),
  'first',
  'replay does not mutate template_variables on existing row'
);

-- Simulate UNIQUE race: row exists before ingest INSERT (concurrent commit wins).
insert into message_dispatcher.message_dispatches (
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  scheduled_for
)
select
  gen_random_uuid(),
  f.profile_id,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _parallel_ingest_fixture f;

create temp table _race_key as
select d.idempotency_key
from message_dispatcher.message_dispatches d
join _parallel_ingest_fixture f on d.profile_id = f.profile_id
where d.channel = 'push'
limit 1;

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select idempotency_key from _race_key),
      (select profile_id from _parallel_ingest_fixture),
      'push'::message_dispatcher.message_channel,
      'engagement_push'
    )->>'duplicate'
  ),
  'true',
  'ingest handles pre-existing row as duplicate replay (race-safe path)'
);

select finish();

rollback;
