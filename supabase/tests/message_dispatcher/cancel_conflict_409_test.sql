-- pgTAP: cancel rejects PROCESSING and DELIVERED (task 31, Req.4 AC3).

begin;

select plan(2);

select set_config('request.jwt.claim.role', 'service_role', true);

create temp table _conflict_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as processing_id,
  gen_random_uuid() as delivered_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status
)
select
  f.processing_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status
from _conflict_fixture f;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status
)
select
  f.delivered_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'DELIVERED'::message_dispatcher.message_dispatch_status
from _conflict_fixture f;

select throws_ok(
  $test$
    select message_dispatcher.message_dispatcher_cancel(
      (select processing_id from _conflict_fixture)
    )
  $test$,
  '40901',
  null,
  'PROCESSING cancel raises 40901'
);

select throws_ok(
  $test$
    select message_dispatcher.message_dispatcher_cancel(
      (select delivered_id from _conflict_fixture)
    )
  $test$,
  '40901',
  null,
  'DELIVERED cancel raises 40901'
);

select finish();

rollback;
