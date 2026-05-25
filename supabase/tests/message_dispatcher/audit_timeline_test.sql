-- pgTAP: audit_timeline RPC (design §10.4, task 80, Req.6 AC3).

begin;

select plan(3);

select set_config('request.jwt.claim.role', 'service_role', true);

create temp table _audit_timeline_fixture as
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
  scheduled_for
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _audit_timeline_fixture f;

update message_dispatcher.message_dispatches d
set
  status = 'PROCESSING',
  locked_by = 'worker-audit',
  locked_until = now() + interval '30 seconds'
from _audit_timeline_fixture f
where d.id = f.dispatch_id;

update message_dispatcher.message_dispatches d
set
  status = 'DELIVERED',
  locked_by = null,
  locked_until = null
from _audit_timeline_fixture f
where d.id = f.dispatch_id;

select ok(
  jsonb_array_length(
    message_dispatcher.message_dispatcher_audit_timeline(
      (select dispatch_id from _audit_timeline_fixture)
    )
  ) >= 2,
  'timeline includes status transition audit rows'
);

select is(
  (
    select
      message_dispatcher.message_dispatcher_audit_timeline(
        (select dispatch_id from _audit_timeline_fixture)
      )->0->>'old_status'
  ),
  'QUEUED',
  'first transition starts from QUEUED'
);

select is(
  (
    select
      message_dispatcher.message_dispatcher_audit_timeline(
        (select dispatch_id from _audit_timeline_fixture)
      )->-1->>'new_status'
  ),
  'DELIVERED',
  'last transition ends at DELIVERED'
);

select finish();

rollback;
