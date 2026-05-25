-- pgTAP: ingest SCHEDULED vs QUEUED branching (design §4.1, task 28, Req.4 AC1).

begin;

select plan(2);

create temp table _schedule_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as future_key,
  gen_random_uuid() as immediate_key
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _schedule_fixture
on conflict (profile_id) do nothing;

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select future_key from _schedule_fixture),
      (select profile_id from _schedule_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      '{}'::jsonb,
      now() + interval '2 hours'
    )->>'status'
  ),
  'SCHEDULED',
  'future scheduled_for yields SCHEDULED'
);

select is(
  (
    select message_dispatcher.message_dispatcher_ingest(
      (select immediate_key from _schedule_fixture),
      (select profile_id from _schedule_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      '{}'::jsonb,
      now()
    )->>'status'
  ),
  'QUEUED',
  'due scheduled_for yields QUEUED'
);

select finish();

rollback;
