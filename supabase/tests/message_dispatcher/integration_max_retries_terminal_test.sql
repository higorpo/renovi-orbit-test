-- pgTAP: integration — four failures → max_retries terminal (task 91, Req.7 AC3).

begin;

\ir fixtures/clear_due_dispatches.inc

select plan(12);

create temp table _max_retries_fixture as
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
from _max_retries_fixture f;

-- Failure 1: checkout → report → FAILED_RETRYABLE (retry_count 1)
select is(
  jsonb_array_length(
    message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-max-int')
  ),
  1,
  'attempt 1 checkout'
);

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _max_retries_fixture),
      'worker-max-int',
      'email'::message_dispatcher.message_channel,
      false,
      null,
      503,
      'provider_unavailable',
      'failure 1',
      '[]'::jsonb,
      true
    )->>'status'
  ),
  'FAILED_RETRYABLE',
  'failure 1 → FAILED_RETRYABLE'
);

select is(
  (select d.retry_count from message_dispatcher.message_dispatches d join _max_retries_fixture f on d.id = f.dispatch_id),
  1,
  'retry_count 1 after first failure'
);

update message_dispatcher.message_dispatches d
set next_retry_at = now() - interval '1 minute'
from _max_retries_fixture f
where d.id = f.dispatch_id;

select is(message_dispatcher.message_dispatcher_promote_retries(), 1, 'promote after failure 1');

-- Failure 2
do $$ begin
  perform message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-max-int');
end $$;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _max_retries_fixture),
      'worker-max-int',
      'email'::message_dispatcher.message_channel,
      false,
      null,
      503,
      'provider_unavailable',
      'failure 2',
      '[]'::jsonb,
      true
    )->>'status'
  ),
  'FAILED_RETRYABLE',
  'failure 2 → FAILED_RETRYABLE'
);

select is(
  (select d.retry_count from message_dispatcher.message_dispatches d join _max_retries_fixture f on d.id = f.dispatch_id),
  2,
  'retry_count 2 after second failure'
);

update message_dispatcher.message_dispatches d
set next_retry_at = now() - interval '1 minute'
from _max_retries_fixture f
where d.id = f.dispatch_id;

select is(message_dispatcher.message_dispatcher_promote_retries(), 1, 'promote after failure 2');

-- Failure 3
do $$ begin
  perform message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-max-int');
end $$;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _max_retries_fixture),
      'worker-max-int',
      'email'::message_dispatcher.message_channel,
      false,
      null,
      503,
      'provider_unavailable',
      'failure 3',
      '[]'::jsonb,
      true
    )->>'status'
  ),
  'FAILED_RETRYABLE',
  'failure 3 → FAILED_RETRYABLE'
);

select is(
  (select d.retry_count from message_dispatcher.message_dispatches d join _max_retries_fixture f on d.id = f.dispatch_id),
  3,
  'retry_count 3 after third failure'
);

update message_dispatcher.message_dispatches d
set next_retry_at = now() - interval '1 minute'
from _max_retries_fixture f
where d.id = f.dispatch_id;

select is(message_dispatcher.message_dispatcher_promote_retries(), 1, 'promote after failure 3');

-- Failure 4: retry budget exhausted → terminal
do $$ begin
  perform message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-max-int');
end $$;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _max_retries_fixture),
      'worker-max-int',
      'email'::message_dispatcher.message_channel,
      false,
      null,
      503,
      'provider_unavailable',
      'failure 4',
      '[]'::jsonb,
      true
    )->>'reason'
  ),
  'max_retries_exhausted',
  'fourth failure returns max_retries_exhausted'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _max_retries_fixture f on d.id = f.dispatch_id
  ),
  'FAILED_TERMINAL',
  'fourth failure → FAILED_TERMINAL'
);

select finish();

rollback;
