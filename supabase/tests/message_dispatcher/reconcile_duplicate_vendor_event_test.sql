-- pgTAP: duplicate vendor_event_id reconcile noop (design §4.5, task 75, Req.6 AC2).

begin;

select plan(4);

create temp table _dup_fixture as
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
  're_vendor_dup_1',
  'worker-dup',
  now() + interval '30 seconds'
from _dup_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_dup_1',
      'resend',
      'email.delivered',
      're_vendor_dup_1',
      '{}'::jsonb
    )->>'status'
  ),
  'DELIVERED',
  'first webhook delivery applies DELIVERED'
);

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_dup_1',
      'resend',
      'email.bounced',
      're_vendor_dup_1',
      '{}'::jsonb
    )->>'duplicate'
  ),
  'true',
  'replay returns duplicate noop'
);

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_dup_1',
      'resend',
      'email.bounced',
      're_vendor_dup_1',
      '{}'::jsonb
    )->>'dispatch_updated'
  ),
  'false',
  'duplicate path does not update dispatch'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _dup_fixture f on d.id = f.dispatch_id
  ),
  'DELIVERED',
  'dispatch stays DELIVERED after duplicate bounce replay'
);

select finish();

rollback;
