-- pgTAP: activate_scheduled does not affect dispatches in non-SCHEDULED states (design §4.2).

begin;

select plan(4);

create temp table _act_neg_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as queued_id,
  gen_random_uuid() as processing_id,
  gen_random_uuid() as delivered_id,
  gen_random_uuid() as failed_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status, scheduled_for
)
select f.queued_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now() - interval '1 hour'
from _act_neg_fixture f;

insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status, scheduled_for,
  locked_until, locked_by
)
select f.processing_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now() - interval '1 hour',
  now() + interval '30 seconds', 'worker-neg'
from _act_neg_fixture f;

insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status, scheduled_for
)
select f.delivered_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'DELIVERED'::message_dispatcher.message_dispatch_status,
  now() - interval '1 hour'
from _act_neg_fixture f;

insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status, scheduled_for,
  failure_code, failure_reason
)
select f.failed_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'FAILED_TERMINAL'::message_dispatcher.message_dispatch_status,
  now() - interval '1 hour',
  'test_failure', 'Test'
from _act_neg_fixture f;

select message_dispatcher.message_dispatcher_activate_scheduled();

select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _act_neg_fixture f on d.id = f.queued_id),
  'QUEUED',
  'QUEUED dispatch not touched by activate_scheduled'
);

select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _act_neg_fixture f on d.id = f.processing_id),
  'PROCESSING',
  'PROCESSING dispatch not touched by activate_scheduled'
);

select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _act_neg_fixture f on d.id = f.delivered_id),
  'DELIVERED',
  'DELIVERED dispatch not touched by activate_scheduled'
);

select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _act_neg_fixture f on d.id = f.failed_id),
  'FAILED_TERMINAL',
  'FAILED_TERMINAL dispatch not touched by activate_scheduled'
);

select finish();

rollback;
