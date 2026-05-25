-- pgTAP: integration — checkout orphan → reclaim → promote (design §4.9, task 88, Req.3 AC3).

begin;

select plan(9);

create temp table _orphan_fixture as
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
  scheduled_for,
  retry_count,
  max_retries
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now(),
  0,
  3
from _orphan_fixture f;

select is(
  (
    select jsonb_array_length(
      message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-orphan-int')
    )
  ),
  1,
  'checkout claims QUEUED row into PROCESSING'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _orphan_fixture f on d.id = f.dispatch_id
  ),
  'PROCESSING',
  'dispatch is PROCESSING after checkout'
);

-- Simulate worker crash: expire the lease.
update message_dispatcher.message_dispatches d
set locked_until = now() - interval '1 minute'
from _orphan_fixture f
where d.id = f.dispatch_id;

select is(
  message_dispatcher.message_dispatcher_reclaim_leases(),
  1,
  'janitor reclaims one stale PROCESSING lease'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _orphan_fixture f on d.id = f.dispatch_id
  ),
  'FAILED_RETRYABLE',
  'orphan with retry budget → FAILED_RETRYABLE'
);

select is(
  (
    select d.failure_code
    from message_dispatcher.message_dispatches d
    join _orphan_fixture f on d.id = f.dispatch_id
  ),
  'lease_expired',
  'failure_code is lease_expired'
);

select ok(
  (
    select d.locked_until is null and d.locked_by is null
    from message_dispatcher.message_dispatches d
    join _orphan_fixture f on d.id = f.dispatch_id
  ),
  'lease fields cleared after reclaim'
);

select ok(
  (
    select d.next_retry_at is not null
    from message_dispatcher.message_dispatches d
    join _orphan_fixture f on d.id = f.dispatch_id
  ),
  'next_retry_at scheduled after reclaim'
);

-- Full recovery chain: force next_retry_at to past so promote picks it up.
update message_dispatcher.message_dispatches d
set next_retry_at = now() - interval '1 minute'
from _orphan_fixture f
where d.id = f.dispatch_id;

select is(
  message_dispatcher.message_dispatcher_promote_retries(),
  1,
  'promote_retries picks up reclaimed row'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _orphan_fixture f on d.id = f.dispatch_id
  ),
  'QUEUED',
  'FAILED_RETRYABLE returns to QUEUED for worker pickup'
);

select finish();

rollback;
