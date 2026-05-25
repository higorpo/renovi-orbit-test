-- pgTAP: cancel cancelable states (design §4.7, task 30, Req.4 AC2).

begin;

select plan(3);

select set_config('request.jwt.claim.role', 'service_role', true);

create temp table _cancel_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as dispatch_id
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
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status
from _cancel_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_cancel(
      (select dispatch_id from _cancel_fixture),
      'user_opt_out'
    )->>'status'
  ),
  'CANCELED',
  'QUEUED dispatch canceled'
);

select is(
  (
    select d.cancel_reason
    from message_dispatcher.message_dispatches d
    join _cancel_fixture f on d.id = f.dispatch_id
  ),
  'user_opt_out',
  'cancel_reason persisted'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _cancel_fixture f on d.id = f.dispatch_id
  ),
  'CANCELED',
  'status is CANCELED after RPC'
);

select finish();

rollback;
