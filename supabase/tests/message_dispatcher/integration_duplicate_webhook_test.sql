-- pgTAP: integration — duplicate webhook vendor_event_id noop (task 92, Req.6 AC2).

begin;

select plan(6);

create temp table _webhook_dup_fixture as
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
  're_webhook_dup_int',
  'worker-webhook-dup',
  now() + interval '30 seconds'
from _webhook_dup_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_webhook_dup_int',
      'resend',
      'email.delivered',
      're_webhook_dup_int',
      '{"type":"email.delivered"}'::jsonb
    )->>'status'
  ),
  'DELIVERED',
  'first webhook reconcile applies DELIVERED'
);

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_webhook_dup_int',
      'resend',
      'email.bounced',
      're_webhook_dup_int',
      '{"type":"email.bounced"}'::jsonb
    )->>'duplicate'
  ),
  'true',
  'second webhook with same vendor_event_id is duplicate'
);

select is(
  (
    select count(*)::integer
    from message_dispatcher.message_dispatcher_vendor_events v
    where v.vendor_event_id = 'svix_evt_webhook_dup_int'
  ),
  1,
  'vendor_events table has exactly one row for vendor_event_id'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _webhook_dup_fixture f on d.id = f.dispatch_id
  ),
  'DELIVERED',
  'dispatch unchanged after duplicate bounce replay'
);

select is(
  (
    select d.failure_code
    from message_dispatcher.message_dispatches d
    join _webhook_dup_fixture f on d.id = f.dispatch_id
  ),
  null,
  'duplicate bounce does not apply hard_bounce failure_code'
);

select ok(
  (
    select count(*) = 1
    from message_dispatcher.message_dispatcher_audit a
    join _webhook_dup_fixture f on a.dispatch_id = f.dispatch_id
    where a.new_status = 'DELIVERED'
  ),
  'audit has single DELIVERED transition from first webhook only'
);

select finish();

rollback;
