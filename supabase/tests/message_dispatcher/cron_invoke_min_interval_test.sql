-- pgTAP: dynamic worker fan-out (replaces throttle-based invoke).
-- invoke_worker returns N = ceil(queued / batch_size), capped at max_parallel_workers.

begin;

select plan(5);

-- Empty queue → 0 workers invoked (vault secrets are not seeded so early return).
select is(
  message_dispatcher.message_dispatcher_invoke_worker(),
  0,
  'invoke_worker returns 0 when queue is empty'
);

-- Grab a real profile from seed data for FK compliance.
create temp table _fanout_fixture as
select p.id as profile_id
from public.profiles p
limit 1;

-- Seed a template for fixtures.
insert into message_dispatcher.message_templates (template_key, channel, body_template, active)
values ('_fanout_test', 'email', 'body', true)
on conflict do nothing;

-- Seed 30 QUEUED dispatches (< batch_size 50 → would need 1 worker).
insert into message_dispatcher.message_dispatches (
  idempotency_key, profile_id, channel, template_key,
  status, scheduled_for
)
select
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  '_fanout_test',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _fanout_fixture f, generate_series(1, 30);

-- 30 queued, batch_size=50 → ceil(30/50)=1, capped at max_parallel_workers=5 → 1 worker.
select is(
  message_dispatcher.message_dispatcher_invoke_worker(),
  1,
  'invoke_worker returns 1 for 30 QUEUED dispatches with batch_size=50'
);

-- Verify the fan-out calculation directly.
-- batch_size=50, max_parallel=5 → ceil(30/50) = 1
select is(
  least(ceil(30::numeric / 50::numeric)::integer, 5),
  1,
  'ceil(30/50) capped at 5 equals 1 worker'
);

-- ceil(200/50) = 4 workers
select is(
  least(ceil(200::numeric / 50::numeric)::integer, 5),
  4,
  'ceil(200/50) capped at 5 equals 4 workers'
);

-- ceil(1000/50) = 20, capped to 5
select is(
  least(ceil(1000::numeric / 50::numeric)::integer, 5),
  5,
  'ceil(1000/50) capped at 5 equals 5 workers'
);

select finish();

rollback;
