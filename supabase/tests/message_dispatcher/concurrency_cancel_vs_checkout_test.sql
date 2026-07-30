-- pgTAP: cancel vs checkout race ordering (design §4.10, task 102, Req.4 AC3).

begin;

\ir fixtures/clear_due_dispatches.inc

select plan(6);

select set_config('request.jwt.claim.role', 'service_role', true);

-- Scenario A: cancel wins (FOR UPDATE) before checkout (SKIP LOCKED on QUEUED only).
create temp table _cancel_first_fixture as
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
  scheduled_for
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _cancel_first_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_cancel(
      (select dispatch_id from _cancel_first_fixture),
      'race_cancel_first'
    )->>'status'
  ),
  'CANCELED',
  'cancel claims QUEUED row first'
);

select is(
  jsonb_array_length(
    message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-race-a')
  ),
  0,
  'checkout skips CANCELED row'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _cancel_first_fixture f on d.id = f.dispatch_id
  ),
  'CANCELED',
  'dispatch stays CANCELED after checkout attempt'
);

-- Scenario B: checkout wins before cancel.
create temp table _checkout_first_fixture as
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
  scheduled_for
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _checkout_first_fixture f;

select is(
  jsonb_array_length(
    message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-race-b')
  ),
  1,
  'checkout claims QUEUED row first'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _checkout_first_fixture f on d.id = f.dispatch_id
  ),
  'PROCESSING',
  'checkout moves dispatch to PROCESSING'
);

select throws_ok(
  $test$
    select message_dispatcher.message_dispatcher_cancel(
      (select dispatch_id from _checkout_first_fixture),
      'race_too_late'
    )
  $test$,
  '40901',
  null,
  'cancel loses race when dispatch already PROCESSING'
);

select finish();

rollback;
