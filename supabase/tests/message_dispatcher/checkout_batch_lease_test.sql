-- pgTAP: checkout_batch sets lease fields (design §4.3, task 44, Req.3 AC2).

begin;

\ir fixtures/clear_due_dispatches.inc

select plan(3);

create temp table _lease_fixture as
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
from _lease_fixture f;

select message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-lease-test');

select is(
  (
    select d.locked_by
    from message_dispatcher.message_dispatches d
    join _lease_fixture f on d.id = f.dispatch_id
  ),
  'worker-lease-test',
  'locked_by set to worker id'
);

select ok(
  (
    select d.locked_until > now()
    from message_dispatcher.message_dispatches d
    join _lease_fixture f on d.id = f.dispatch_id
  ),
  'locked_until is in the future (now + lease_seconds)'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _lease_fixture f on d.id = f.dispatch_id
  ),
  'PROCESSING',
  'status PROCESSING with lease'
);

select finish();

rollback;
