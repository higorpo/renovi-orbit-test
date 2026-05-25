-- pgTAP: checkout no_push_targets terminal, omitted from payload (design §2.6, task 48).

begin;

select plan(4);

create temp table _no_push_fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
where not exists (
  select 1
  from public.user_device_beacons b
  where b.profile_id = p.id
    and b.push_enabled = true
    and b.fcm_token is not null
    and trim(b.fcm_token) <> ''
)
limit 1;

select ok((select count(*) from _no_push_fixture) = 1, 'profile without eligible push beacons exists');

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
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _no_push_fixture f;

select is(
  jsonb_array_length(message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-no-push')),
  0,
  'dispatch omitted from checkout payload when no push targets'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _no_push_fixture f on d.id = f.dispatch_id
  ),
  'FAILED_TERMINAL',
  'dispatch terminal when no push targets'
);

select is(
  (
    select d.failure_code
    from message_dispatcher.message_dispatches d
    join _no_push_fixture f on d.id = f.dispatch_id
  ),
  'no_push_targets',
  'failure_code set'
);

select finish();

rollback;
