-- pgTAP: cancel from all cancelable states + idempotent re-cancel + FAILED_TERMINAL rejection (design §4.7).

begin;

select plan(9);

select set_config('request.jwt.claim.role', 'service_role', true);

create temp table _cancel_all_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as scheduled_id,
  gen_random_uuid() as pending_id,
  gen_random_uuid() as retryable_id,
  gen_random_uuid() as terminal_id,
  gen_random_uuid() as already_canceled_id
from public.profiles p
limit 1;

-- SCHEDULED dispatch
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status, scheduled_for
)
select
  f.scheduled_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'SCHEDULED'::message_dispatcher.message_dispatch_status,
  now() + interval '1 hour'
from _cancel_all_fixture f;

-- PENDING_EVALUATION dispatch
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status
)
select
  f.pending_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'PENDING_EVALUATION'::message_dispatcher.message_dispatch_status
from _cancel_all_fixture f;

-- FAILED_RETRYABLE dispatch
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status,
  retry_count, max_retries, next_retry_at
)
select
  f.retryable_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'FAILED_RETRYABLE'::message_dispatcher.message_dispatch_status,
  1, 3, now() + interval '1 hour'
from _cancel_all_fixture f;

-- FAILED_TERMINAL dispatch
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status,
  failure_code
)
select
  f.terminal_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'FAILED_TERMINAL'::message_dispatcher.message_dispatch_status,
  'test_terminal'
from _cancel_all_fixture f;

-- Already CANCELED dispatch
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status,
  cancel_reason
)
select
  f.already_canceled_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'CANCELED'::message_dispatcher.message_dispatch_status,
  'previously_canceled'
from _cancel_all_fixture f;

-- Cancel SCHEDULED
select is(
  (
    select message_dispatcher.message_dispatcher_cancel(
      (select scheduled_id from _cancel_all_fixture),
      'test_scheduled_cancel'
    )->>'status'
  ),
  'CANCELED',
  'SCHEDULED cancel succeeds'
);

select is(
  (select d.cancel_reason from message_dispatcher.message_dispatches d
   join _cancel_all_fixture f on d.id = f.scheduled_id),
  'test_scheduled_cancel',
  'SCHEDULED cancel_reason persisted'
);

-- Cancel PENDING_EVALUATION
select is(
  (
    select message_dispatcher.message_dispatcher_cancel(
      (select pending_id from _cancel_all_fixture),
      'test_pending_cancel'
    )->>'status'
  ),
  'CANCELED',
  'PENDING_EVALUATION cancel succeeds'
);

select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _cancel_all_fixture f on d.id = f.pending_id),
  'CANCELED',
  'PENDING_EVALUATION row is CANCELED'
);

-- Cancel FAILED_RETRYABLE
select is(
  (
    select message_dispatcher.message_dispatcher_cancel(
      (select retryable_id from _cancel_all_fixture),
      'test_retryable_cancel'
    )->>'status'
  ),
  'CANCELED',
  'FAILED_RETRYABLE cancel succeeds'
);

select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _cancel_all_fixture f on d.id = f.retryable_id),
  'CANCELED',
  'FAILED_RETRYABLE row is CANCELED'
);

-- FAILED_TERMINAL cancel must fail
select throws_ok(
  $test$
    select message_dispatcher.message_dispatcher_cancel(
      (select terminal_id from _cancel_all_fixture)
    )
  $test$,
  'P0001',
  null,
  'FAILED_TERMINAL cancel raises P0001'
);

-- Idempotent re-cancel (already CANCELED → noop return)
select is(
  (
    select message_dispatcher.message_dispatcher_cancel(
      (select already_canceled_id from _cancel_all_fixture),
      'should_not_override'
    )->>'status'
  ),
  'CANCELED',
  'already CANCELED returns idempotent success'
);

select is(
  (select d.cancel_reason from message_dispatcher.message_dispatches d
   join _cancel_all_fixture f on d.id = f.already_canceled_id),
  'previously_canceled',
  'idempotent cancel does not overwrite original cancel_reason'
);

select finish();

rollback;
