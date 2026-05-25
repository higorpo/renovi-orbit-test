-- pgTAP: updated_at is set to now() on status transitions via RPCs (design §3.3).

begin;

select plan(4);

create temp table _upd_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _upd_fixture
on conflict (profile_id) do nothing;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  scheduled_for,
  created_at,
  updated_at
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now(),
  now() - interval '10 minutes',
  now() - interval '10 minutes'
from _upd_fixture f;

select ok(
  (
    select d.updated_at < now() - interval '5 minutes'
    from message_dispatcher.message_dispatches d
    join _upd_fixture f on d.id = f.dispatch_id
  ),
  'updated_at starts in the past (fixture baseline)'
);

-- Checkout should bump updated_at
select message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-upd-test');

select ok(
  (
    select d.updated_at >= now() - interval '2 seconds'
    from message_dispatcher.message_dispatches d
    join _upd_fixture f on d.id = f.dispatch_id
  ),
  'checkout bumps updated_at to now()'
);

-- Report DELIVERED should bump updated_at again
update message_dispatcher.message_dispatches d
set updated_at = now() - interval '5 minutes'
from _upd_fixture f
where d.id = f.dispatch_id;

select message_dispatcher.message_dispatcher_report_delivery_outcome(
  (select dispatch_id from _upd_fixture),
  'worker-upd-test',
  'email'::message_dispatcher.message_channel,
  true,
  null,
  200
);

select ok(
  (
    select d.updated_at >= now() - interval '2 seconds'
    from message_dispatcher.message_dispatches d
    join _upd_fixture f on d.id = f.dispatch_id
  ),
  'report DELIVERED bumps updated_at'
);

-- Cancel: create a second dispatch and cancel it (run as service_role)
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table _cancel_upd as
select
  (select profile_id from _upd_fixture) as profile_id,
  gen_random_uuid() as dispatch_id;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  scheduled_for,
  created_at,
  updated_at
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now(),
  now() - interval '10 minutes',
  now() - interval '10 minutes'
from _cancel_upd f;

select message_dispatcher.message_dispatcher_cancel(
  (select dispatch_id from _cancel_upd),
  'testing updated_at'
);

select ok(
  (
    select d.updated_at >= now() - interval '2 seconds'
    from message_dispatcher.message_dispatches d
    join _cancel_upd f on d.id = f.dispatch_id
  ),
  'cancel bumps updated_at'
);

select finish();

rollback;
