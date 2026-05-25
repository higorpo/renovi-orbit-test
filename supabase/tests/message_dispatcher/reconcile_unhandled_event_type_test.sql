-- pgTAP: reconcile with unhandled event type and soft bounce (design §4.5).

begin;

select plan(5);

create temp table _unhandled_fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status,
  scheduled_for, vendor_message_id, locked_by, locked_until
)
select
  f.dispatch_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now(), 're_vendor_unhandled_1', 'worker-1', now() + interval '30 seconds'
from _unhandled_fixture f;

-- Unknown event type (e.g. email.opened, email.clicked) → noop
select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_opened_1',
      'resend',
      'email.opened',
      're_vendor_unhandled_1',
      '{"type":"email.opened"}'::jsonb
    )->>'reason'
  ),
  'unhandled_event_type',
  'email.opened is unhandled — noop'
);

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_opened_1',
      'resend',
      'email.opened',
      're_vendor_unhandled_1',
      '{}'::jsonb
    )->>'duplicate'
  ),
  'true',
  'replay of same vendor_event_id is duplicate'
);

-- email.complained → also unhandled (not delivered or bounced)
select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_complained_1',
      'resend',
      'email.complained',
      're_vendor_unhandled_1',
      '{"type":"email.complained"}'::jsonb
    )->>'reason'
  ),
  'unhandled_event_type',
  'email.complained is unhandled — noop'
);

-- Dispatch status unchanged after unhandled events
select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _unhandled_fixture f on d.id = f.dispatch_id),
  'PROCESSING',
  'dispatch still PROCESSING after unhandled events'
);

-- email.sent (not delivered) → also unhandled
select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_sent_1',
      'resend',
      'email.sent',
      're_vendor_unhandled_1',
      '{"type":"email.sent"}'::jsonb
    )->>'reason'
  ),
  'unhandled_event_type',
  'email.sent is unhandled — noop'
);

select finish();

rollback;
