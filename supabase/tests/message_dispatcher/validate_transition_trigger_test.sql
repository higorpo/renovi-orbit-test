-- pgTAP: message_dispatches_validate_transition (design §3.3.1, task 12).
-- Illegal transitions must raise P0001.

begin;

select plan(3);

create temp table _transition_fixture as
select p.id as profile_id
from public.profiles p
limit 1;

-- Insert a QUEUED dispatch for testing.
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status
)
select
  gen_random_uuid(),
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status
from _transition_fixture f;

-- Insert a DELIVERED dispatch for testing terminal state.
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status
)
select
  gen_random_uuid(),
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'DELIVERED'::message_dispatcher.message_dispatch_status
from _transition_fixture f;

-- Legal transition: QUEUED -> PROCESSING
select lives_ok(
  $test$
    update message_dispatcher.message_dispatches
    set status = 'PROCESSING'
    where id = (
      select d.id
      from message_dispatcher.message_dispatches d
      where d.status = 'QUEUED'
      limit 1
    )
  $test$,
  'QUEUED -> PROCESSING allowed'
);

-- Illegal skip: PROCESSING -> DELIVERED not in allowed (it IS allowed)
-- Actually test QUEUED -> DELIVERED (bypasses PROCESSING)
-- Re-insert a QUEUED row since the previous one moved to PROCESSING.
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status
)
select
  gen_random_uuid(),
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status
from _transition_fixture f;

select throws_ok(
  $test$
    update message_dispatcher.message_dispatches
    set status = 'DELIVERED'
    where id = (
      select d.id
      from message_dispatcher.message_dispatches d
      where d.status = 'QUEUED'
      limit 1
    )
  $test$,
  'P0001',
  null,
  'QUEUED -> DELIVERED skip must fail'
);

-- Terminal has no outbound: DELIVERED -> QUEUED
select throws_ok(
  $test$
    update message_dispatcher.message_dispatches
    set status = 'QUEUED'
    where id = (
      select d.id
      from message_dispatcher.message_dispatches d
      where d.status = 'DELIVERED'
      limit 1
    )
  $test$,
  'P0001',
  null,
  'DELIVERED -> QUEUED must fail'
);

select finish();

rollback;
