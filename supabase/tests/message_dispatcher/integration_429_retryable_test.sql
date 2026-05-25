-- pgTAP: integration — HTTP 429 rate limit → FAILED_RETRYABLE + backoff (task 89, Req.7 AC1).

begin;

select plan(6);

create temp table _rate_limit_fixture as
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
  locked_by,
  locked_until,
  retry_count,
  max_retries
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now(),
  'worker-429-int',
  now() + interval '30 seconds',
  0,
  3
from _rate_limit_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _rate_limit_fixture),
      'worker-429-int',
      'email'::message_dispatcher.message_channel,
      false,
      null,
      429,
      'rate_limit_exceeded',
      'Resend rate limit',
      '[]'::jsonb,
      true
    )->>'status'
  ),
  'FAILED_RETRYABLE',
  'mock HTTP 429 with retryable=true → FAILED_RETRYABLE'
);

select is(
  (
    select d.next_retry_at
    from message_dispatcher.message_dispatches d
    join _rate_limit_fixture f on d.id = f.dispatch_id
  ),
  message_dispatcher.message_dispatcher_compute_next_retry_at(1),
  'next_retry_at matches exponential backoff for retry_count 1 (+120s)'
);

select is(
  (
    select d.metadata->>'last_http_status'
    from message_dispatcher.message_dispatches d
    join _rate_limit_fixture f on d.id = f.dispatch_id
  ),
  '429',
  'last_http_status 429 stored in metadata'
);

select is(
  (
    select d.failure_code
    from message_dispatcher.message_dispatches d
    join _rate_limit_fixture f on d.id = f.dispatch_id
  ),
  'rate_limit_exceeded',
  'failure_code preserved from worker classifier'
);

-- Recovery: force next_retry_at to past so promote picks it up.
update message_dispatcher.message_dispatches d
set next_retry_at = now() - interval '1 minute'
from _rate_limit_fixture f
where d.id = f.dispatch_id;

select is(
  message_dispatcher.message_dispatcher_promote_retries(),
  1,
  'promote_retries after 429 backoff window'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _rate_limit_fixture f on d.id = f.dispatch_id
  ),
  'QUEUED',
  'rate-limited dispatch returns to QUEUED for retry'
);

select finish();

rollback;
