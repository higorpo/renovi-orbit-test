-- pgTAP: checkout_batch SKIP LOCKED (design §4.3, task 43, Req.3 AC1).

begin;

\ir fixtures/clear_due_dispatches.inc

select plan(3);

create temp table _checkout_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as first_id,
  gen_random_uuid() as second_id
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
  f.first_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now() - interval '1 minute'
from _checkout_fixture f;

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
  f.second_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now() - interval '1 minute'
from _checkout_fixture f;

select is(
  jsonb_array_length(message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-a')),
  1,
  'checkout claims one row when limit is 1'
);
-- p_worker_id required since task 44

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches d
    join _checkout_fixture f on d.id in (f.first_id, f.second_id)
    where d.status = 'PROCESSING'
  ),
  1,
  'exactly one row in PROCESSING'
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches d
    join _checkout_fixture f on d.id in (f.first_id, f.second_id)
    where d.status = 'QUEUED'
  ),
  1,
  'second row remains QUEUED'
);

select finish();

rollback;
