-- pgTAP: trg_message_dispatcher_audit appends rows (design §3.6.1, task 39, Req.6 AC1).

begin;

select plan(2);

create temp table _audit_trg_fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status
from _audit_trg_fixture f;

update message_dispatcher.message_dispatches d
set status = 'CANCELED', cancel_reason = 'test'
from _audit_trg_fixture f
where d.id = f.dispatch_id;

select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatcher_audit a
    join _audit_trg_fixture f on a.dispatch_id = f.dispatch_id
    where a.old_status = 'QUEUED'
      and a.new_status = 'CANCELED'
  ),
  'audit row recorded on status change'
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatcher_audit a
    join _audit_trg_fixture f on a.dispatch_id = f.dispatch_id
  ),
  1,
  'single audit append for one update'
);

select finish();

rollback;
