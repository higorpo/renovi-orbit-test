-- pgTAP: stale worker report after janitor reclaim is no-op (design §4.10, task 101).

begin;

select plan(5);

create temp table _stale_report_fixture as
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
  'worker-stale',
  now() - interval '1 minute',
  0,
  3
from _stale_report_fixture f;

select is(
  message_dispatcher.message_dispatcher_reclaim_leases(),
  1,
  'janitor reclaims orphan PROCESSING lease'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _stale_report_fixture f on d.id = f.dispatch_id
  ),
  'FAILED_RETRYABLE',
  'reclaim moves dispatch off PROCESSING'
);

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _stale_report_fixture),
      'worker-stale',
      'email'::message_dispatcher.message_channel,
      true,
      're_stale_should_not_apply',
      200
    )->>'reason'
  ),
  'invalid_status',
  'stale worker success report is no-op after reclaim'
);

select ok(
  (
    select (message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _stale_report_fixture),
      'worker-stale',
      'email'::message_dispatcher.message_channel,
      true,
      're_stale_should_not_apply',
      200
    )->>'applied')::boolean = false
  ),
  'applied is false for stale report'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _stale_report_fixture f on d.id = f.dispatch_id
  ),
  'FAILED_RETRYABLE',
  'status unchanged after stale worker report'
);

select finish();

rollback;
