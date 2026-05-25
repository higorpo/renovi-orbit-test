-- pgTAP: integration — pg_net invoke failure leaves QUEUED rows (design §8.1, task 93).

begin;

select plan(5);

create temp table _queued_fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  scheduled_for
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _queued_fixture f;

-- Simulate cron firing pg_net against an unreachable worker (worker down).
update public.platform_constants
set value = to_jsonb('http://127.0.0.1:9/message-dispatcher-worker'::text)
where key = 'message_dispatcher.worker_url';

update public.platform_constants
set value = to_jsonb('cron-secret-pgnet-test'::text)
where key = 'message_dispatcher.cron_secret';

select lives_ok(
  $$select message_dispatcher.message_dispatcher_invoke_worker()$$,
  'invoke_worker runs pg_net POST even when worker is down'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _queued_fixture f on d.id = f.dispatch_id
  ),
  'QUEUED',
  'dispatch stays QUEUED after failed/unreachable worker invoke'
);

select ok(
  (
    select d.locked_by is null and d.locked_until is null
    from message_dispatcher.message_dispatches d
    join _queued_fixture f on d.id = f.dispatch_id
  ),
  'invoke_worker does not acquire lease (checkout not run in cron path)'
);

select lives_ok(
  $$select message_dispatcher.message_dispatcher_invoke_worker()$$,
  'second cron tick is safe to retry while worker down'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _queued_fixture f on d.id = f.dispatch_id
  ),
  'QUEUED',
  'dispatch still QUEUED after second invoke'
);

select finish();

rollback;
