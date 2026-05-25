-- pgTAP: report terminal failure → FAILED_TERMINAL (task 64, Req.7 AC2).

begin;

select plan(3);

create temp table _terminal_fixture as
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
  locked_until
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now(),
  'worker-terminal',
  now() + interval '30 seconds'
from _terminal_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _terminal_fixture),
      'worker-terminal',
      'email'::message_dispatcher.message_channel,
      false,
      null,
      400,
      'invalid_email',
      'bad recipient',
      '[]'::jsonb,
      false
    )->>'status'
  ),
  'FAILED_TERMINAL',
  'non-retryable failure is terminal'
);

select is(
  (
    select d.failure_code
    from message_dispatcher.message_dispatches d
    join _terminal_fixture f on d.id = f.dispatch_id
  ),
  'invalid_email',
  'failure_code persisted'
);

select ok(
  (
    select d.locked_by is null and d.locked_until is null
    from message_dispatcher.message_dispatches d
    join _terminal_fixture f on d.id = f.dispatch_id
  ),
  'lease cleared on terminal failure'
);

select finish();

rollback;
