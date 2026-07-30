-- pgTAP: audit trigger propagates correlation_id and changed_by correctly (design §3.6.1).

begin;

\ir fixtures/clear_due_dispatches.inc

select plan(5);

create temp table _audit_cb_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as dispatch_id,
  gen_random_uuid() as corr_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  correlation_id,
  status,
  scheduled_for
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  f.corr_id,
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _audit_cb_fixture f;

-- Transition QUEUED -> PROCESSING via checkout
select message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-audit-cb');

select is(
  (
    select a.correlation_id
    from message_dispatcher.message_dispatcher_audit a
    join _audit_cb_fixture f on a.dispatch_id = f.dispatch_id
    where a.old_status = 'QUEUED' and a.new_status = 'PROCESSING'
  ),
  (select corr_id from _audit_cb_fixture),
  'audit row captures correct correlation_id on checkout'
);

select is(
  (
    select a.changed_by
    from message_dispatcher.message_dispatcher_audit a
    join _audit_cb_fixture f on a.dispatch_id = f.dispatch_id
    where a.old_status = 'QUEUED' and a.new_status = 'PROCESSING'
  ),
  'system',
  'changed_by defaults to system when app.changed_by not set'
);

-- Set app.changed_by and transition PROCESSING -> DELIVERED via report
select set_config('app.changed_by', 'worker-integration-test', true);

select message_dispatcher.message_dispatcher_report_delivery_outcome(
  (select dispatch_id from _audit_cb_fixture),
  'worker-audit-cb',
  'email'::message_dispatcher.message_channel,
  true,
  null,
  200
);

select is(
  (
    select a.changed_by
    from message_dispatcher.message_dispatcher_audit a
    join _audit_cb_fixture f on a.dispatch_id = f.dispatch_id
    where a.old_status = 'PROCESSING' and a.new_status = 'DELIVERED'
  ),
  'worker-integration-test',
  'changed_by respects app.changed_by session variable'
);

select is(
  (
    select a.correlation_id
    from message_dispatcher.message_dispatcher_audit a
    join _audit_cb_fixture f on a.dispatch_id = f.dispatch_id
    where a.old_status = 'PROCESSING' and a.new_status = 'DELIVERED'
  ),
  (select corr_id from _audit_cb_fixture),
  'correlation_id persists through DELIVERED transition'
);

-- Verify delta includes expected fields
select ok(
  (
    select a.delta ? 'scheduled_for'
      and a.delta ? 'locked_until'
      and a.delta ? 'retry_count'
    from message_dispatcher.message_dispatcher_audit a
    join _audit_cb_fixture f on a.dispatch_id = f.dispatch_id
    where a.old_status = 'QUEUED' and a.new_status = 'PROCESSING'
    limit 1
  ),
  'audit delta includes scheduled_for, locked_until, and retry_count'
);

select finish();

rollback;
