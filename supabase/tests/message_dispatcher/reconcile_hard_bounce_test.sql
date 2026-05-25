-- pgTAP: reconcile hard bounce → FAILED_TERMINAL (design §8.3, task 77, Req.7 AC2).

begin;

select plan(4);

create temp table _bounce_fixture as
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
  're_vendor_hard_bounce_1',
  'worker-bounce',
  now() + interval '30 seconds'
from _bounce_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_bounce_proc_1',
      'resend',
      'email.bounced',
      're_vendor_hard_bounce_1',
      '{"bounce_type":"hard"}'::jsonb
    )->>'failure_code'
  ),
  'hard_bounce',
  'bounce sets failure_code hard_bounce'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _bounce_fixture f on d.id = f.dispatch_id
  ),
  'FAILED_TERMINAL',
  'dispatch status FAILED_TERMINAL'
);

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_bounce_idem_1',
      'resend',
      'email.bounced',
      're_vendor_hard_bounce_1',
      '{}'::jsonb
    )->>'reason'
  ),
  'terminal_status_unchanged',
  'repeat bounce on terminal dispatch is noop'
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
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now(),
  're_vendor_hard_bounce_2'
from _bounce_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_bounce_queued_1',
      'resend',
      'email.bounced',
      're_vendor_hard_bounce_2',
      '{}'::jsonb
    )->>'status'
  ),
  'FAILED_TERMINAL',
  'bounce from QUEUED transitions to FAILED_TERMINAL'
);

select finish();

rollback;
