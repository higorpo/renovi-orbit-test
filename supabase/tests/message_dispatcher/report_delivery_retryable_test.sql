-- pgTAP: report retryable failure → FAILED_RETRYABLE + backoff (task 63, Req.7 AC1).

begin;

select plan(4);

create temp table _retry_fixture as
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
  'worker-retry',
  now() + interval '30 seconds',
  0,
  3
from _retry_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _retry_fixture),
      'worker-retry',
      'email'::message_dispatcher.message_channel,
      false,
      null,
      503,
      'provider_unavailable',
      'upstream 503',
      '[]'::jsonb,
      true
    )->>'status'
  ),
  'FAILED_RETRYABLE',
  'retryable report sets FAILED_RETRYABLE'
);

select is(
  (
    select d.retry_count
    from message_dispatcher.message_dispatches d
    join _retry_fixture f on d.id = f.dispatch_id
  ),
  1,
  'retry_count incremented'
);

select ok(
  (
    select d.next_retry_at > now()
    from message_dispatcher.message_dispatches d
    join _retry_fixture f on d.id = f.dispatch_id
  ),
  'next_retry_at scheduled in the future'
);

select is(
  (
    select d.metadata->>'last_http_status'
    from message_dispatcher.message_dispatches d
    join _retry_fixture f on d.id = f.dispatch_id
  ),
  '503',
  'http_status stored in metadata'
);

select finish();

rollback;
