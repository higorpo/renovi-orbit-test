-- pgTAP: five workers checkout_batch(limit=1) claim disjoint rows (design §4.3, task 103, Req.3 AC1).

begin;

select plan(5);

create temp table _five_workers_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as id1,
  gen_random_uuid() as id2,
  gen_random_uuid() as id3,
  gen_random_uuid() as id4,
  gen_random_uuid() as id5
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
  f.id1,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now() - interval '1 minute'
from _five_workers_fixture f
union all
select
  f.id2,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now() - interval '1 minute'
from _five_workers_fixture f
union all
select
  f.id3,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now() - interval '1 minute'
from _five_workers_fixture f
union all
select
  f.id4,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now() - interval '1 minute'
from _five_workers_fixture f
union all
select
  f.id5,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now() - interval '1 minute'
from _five_workers_fixture f;

create temp table _checkout_results (
  worker_id text primary key,
  payload jsonb not null
);

insert into _checkout_results (worker_id, payload)
values
  ('worker-1', message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-1')),
  ('worker-2', message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-2')),
  ('worker-3', message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-3')),
  ('worker-4', message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-4')),
  ('worker-5', message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-5'));

select is(
  (select count(*)::integer from _checkout_results where jsonb_array_length(payload) = 1),
  5,
  'each worker checkout_batch(limit=1) returns exactly one item'
);

select is(
  (
    select count(distinct elem->>'id')::integer
    from _checkout_results r,
      lateral jsonb_array_elements(r.payload) elem
  ),
  5,
  'five workers claim five disjoint dispatch ids'
);

select is(
  (
    select count(*)::integer
    from message_dispatcher.message_dispatches d
    join _five_workers_fixture f on d.id in (f.id1, f.id2, f.id3, f.id4, f.id5)
    where d.status = 'PROCESSING'
  ),
  5,
  'all five dispatches are PROCESSING'
);

select is(
  (
    select count(distinct d.locked_by)::integer
    from message_dispatcher.message_dispatches d
    join _five_workers_fixture f on d.id in (f.id1, f.id2, f.id3, f.id4, f.id5)
    where d.status = 'PROCESSING'
  ),
  5,
  'each PROCESSING row has distinct locked_by worker id'
);

select is(
  (
    select count(*)::integer
    from message_dispatcher.message_dispatches d
    join _five_workers_fixture f on d.id in (f.id1, f.id2, f.id3, f.id4, f.id5)
    where d.status = 'QUEUED'
  ),
  0,
  'no QUEUED rows remain in fixture set'
);

select finish();

rollback;
