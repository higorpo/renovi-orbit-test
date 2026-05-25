-- pgTAP: report_delivery_outcome success → DELIVERED (design §5.4, task 61, Req.6 AC2).

begin;

select plan(4);

create temp table _report_fixture as
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
  'worker-report',
  now() + interval '30 seconds'
from _report_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _report_fixture),
      'worker-report',
      'email'::message_dispatcher.message_channel,
      true,
      're_vendor_123',
      200,
      null,
      null,
      '[]'::jsonb
    )->>'applied'
  ),
  'true',
  'report success returns applied true'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _report_fixture f on d.id = f.dispatch_id
  ),
  'DELIVERED',
  'dispatch status DELIVERED'
);

select is(
  (
    select d.vendor_message_id
    from message_dispatcher.message_dispatches d
    join _report_fixture f on d.id = f.dispatch_id
  ),
  're_vendor_123',
  'vendor_message_id persisted'
);

select ok(
  (
    select d.locked_by is null and d.locked_until is null
    from message_dispatcher.message_dispatches d
    join _report_fixture f on d.id = f.dispatch_id
  ),
  'lease cleared after DELIVERED'
);

select finish();

rollback;
