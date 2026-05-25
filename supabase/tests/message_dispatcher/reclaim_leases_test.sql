-- pgTAP: reclaim_leases janitor (design §4.9, task 37, Req.3 AC3).

begin;

select plan(3);

create temp table _reclaim_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as retryable_id,
  gen_random_uuid() as terminal_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  locked_until,
  locked_by,
  retry_count,
  max_retries
)
select
  f.retryable_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now() - interval '2 hours',
  'worker-1',
  1,
  3
from _reclaim_fixture f;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  locked_until,
  locked_by,
  retry_count,
  max_retries
)
select
  f.terminal_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now() - interval '2 hours',
  'worker-2',
  3,
  3
from _reclaim_fixture f;

select is(
  message_dispatcher.message_dispatcher_reclaim_leases(),
  2,
  'reclaims two stale PROCESSING rows'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _reclaim_fixture f on d.id = f.retryable_id
  ),
  'FAILED_RETRYABLE',
  'under max_retries → FAILED_RETRYABLE'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _reclaim_fixture f on d.id = f.terminal_id
  ),
  'FAILED_TERMINAL',
  'retry_count >= max_retries → FAILED_TERMINAL'
);

select finish();

rollback;
