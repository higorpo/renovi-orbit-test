-- pgTAP: report_delivery_outcome lease guard no-op (design §5.4, task 62, Req.3 AC1).

begin;

select plan(2);

create temp table _guard_fixture as
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
  'worker-owner',
  now() - interval '1 minute'
from _guard_fixture f;

select is(
  (
    select message_dispatcher.message_dispatcher_report_delivery_outcome(
      (select dispatch_id from _guard_fixture),
      'other-worker',
      'email'::message_dispatcher.message_channel,
      true,
      're_ignored',
      200
    )->>'reason'
  ),
  'lease_guard',
  'wrong worker with expired lease is no-op'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _guard_fixture f on d.id = f.dispatch_id
  ),
  'PROCESSING',
  'dispatch remains PROCESSING when guard fails'
);

select finish();

rollback;
