-- pgTAP: reconcile delivered → DELIVERED idempotent (design §4.5, task 76, Req.6 AC2).

begin;

select plan(4);

create temp table _delivered_fixture as
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
  're_vendor_delivered_1',
  'worker-delivered',
  now() + interval '30 seconds'
from _delivered_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_delivered_proc_1',
      'resend',
      'email.delivered',
      're_vendor_delivered_1',
      '{}'::jsonb
    )->>'dispatch_updated'
  ),
  'true',
  'PROCESSING upgrades to DELIVERED'
);

update message_dispatcher.message_dispatches d
set
  status = 'DELIVERED',
  locked_by = null,
  locked_until = null
from _delivered_fixture f
where d.id = f.dispatch_id;

create temp table _audit_before_noop as
select count(*)::bigint as audit_count
from message_dispatcher.message_dispatcher_audit a
join _delivered_fixture f on a.dispatch_id = f.dispatch_id;

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_delivered_idem_1',
      'resend',
      'email.delivered',
      're_vendor_delivered_1',
      '{}'::jsonb
    )->>'noop'
  ),
  'true',
  'already DELIVERED returns noop'
);

select is(
  (
    select count(*)::text
    from message_dispatcher.message_dispatcher_audit a
    join _delivered_fixture f on a.dispatch_id = f.dispatch_id
  ),
  (select audit_count::text from _audit_before_noop),
  'noop reconcile does not append audit rows'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _delivered_fixture f on d.id = f.dispatch_id
  ),
  'DELIVERED',
  'dispatch remains DELIVERED'
);

select finish();

rollback;
