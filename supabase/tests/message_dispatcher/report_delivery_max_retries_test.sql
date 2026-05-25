-- pgTAP: report forces terminal when retry_count >= max_retries (task 65, Req.7 AC3).

begin;

select plan(2);

create temp table _max_retry_fixture as
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
  'worker-max',
  now() + interval '30 seconds',
  3,
  3
from _max_retry_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _max_retry_fixture),
      'worker-max',
      'email'::message_dispatcher.message_channel,
      false,
      null,
      503,
      'provider_unavailable',
      'still failing',
      '[]'::jsonb,
      true
    )->>'reason'
  ),
  'max_retries_exhausted',
  'retryable flag ignored when retries exhausted'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _max_retry_fixture f on d.id = f.dispatch_id
  ),
  'FAILED_TERMINAL',
  'status is FAILED_TERMINAL'
);

select finish();

rollback;
