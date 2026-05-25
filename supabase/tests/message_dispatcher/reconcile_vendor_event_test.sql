-- pgTAP: reconcile_vendor_event RPC (design §4.5, task 74, Req.6 AC2).

begin;

select plan(5);

create temp table _reconcile_fixture as
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
  vendor_message_id,
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
  're_vendor_reconcile_1',
  'worker-1',
  now() + interval '30 seconds'
from _reconcile_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_delivered_1',
      'resend',
      'email.delivered',
      're_vendor_reconcile_1',
      '{"type":"email.delivered"}'::jsonb
    )->>'status'
  ),
  'DELIVERED',
  'delivered event upgrades PROCESSING to DELIVERED'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _reconcile_fixture f on d.id = f.dispatch_id
  ),
  'DELIVERED',
  'dispatch row is DELIVERED'
);

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_delivered_1',
      'resend',
      'email.delivered',
      're_vendor_reconcile_1',
      '{}'::jsonb
    )->>'duplicate'
  ),
  'true',
  'duplicate vendor_event_id is noop'
);

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  scheduled_for,
  vendor_message_id
)
select
  gen_random_uuid(),
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now(),
  're_vendor_bounce_1'
from _reconcile_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_bounce_1',
      'resend',
      'email.bounced',
      're_vendor_bounce_1',
      '{"bounce_type":"hard"}'::jsonb
    )->>'failure_code'
  ),
  'hard_bounce',
  'bounce event sets FAILED_TERMINAL hard_bounce'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatcher_vendor_events ve
    where ve.vendor_event_id = 'svix_evt_delivered_1'
      and ve.dispatch_id = (select dispatch_id from _reconcile_fixture)
  ),
  'vendor_events row links dispatch_id'
);

select finish();

rollback;
