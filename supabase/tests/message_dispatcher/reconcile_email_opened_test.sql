-- pgTAP: email.opened webhook records engagement without FSM status change.

begin;

select plan(4);

create temp table _fixture as
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
  vendor_message_id
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'DELIVERED'::message_dispatcher.message_dispatch_status,
  now(),
  're_opened_test_1'
from _fixture f;

-- Call reconcile with email.opened event
select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_opened_1',
      'resend',
      'email.opened',
      're_opened_test_1',
      '{"email_id": "re_opened_test_1"}'::jsonb
    )->>'engagement_recorded'
  ),
  'true',
  'email.opened records engagement'
);

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_opened_1',
      'resend',
      'email.opened',
      're_opened_test_1',
      '{}'::jsonb
    )->>'dispatch_updated'
  ),
  'false',
  'duplicate vendor_event_id is noop (returns dispatch_updated=false)'
);

-- Verify dispatch status unchanged
select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _fixture f on d.id = f.dispatch_id
  ),
  'DELIVERED',
  'dispatch status remains DELIVERED after email.opened'
);

-- Verify engagement row was created
select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatch_engagements e
    join _fixture f on e.dispatch_id = f.dispatch_id
    where e.engagement_type = 'opened'
      and e.source = 'resend_webhook'
  ),
  'engagement row exists with type=opened and source=resend_webhook'
);

select finish();

rollback;
