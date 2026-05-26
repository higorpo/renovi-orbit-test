-- pgTAP: evaluate_pending promotes bypass_limits dispatches to QUEUED even when over quota.

begin;

select plan(3);

create temp table _eval_bypass_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as bypass_dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _eval_bypass_fixture
on conflict (profile_id) do nothing;

-- Fill 5 email dispatches (at the default quota limit)
insert into message_dispatcher.message_dispatches (
  idempotency_key, profile_id, channel, template_key, status, created_at
)
select
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _eval_bypass_fixture f,
  generate_series(1, 5) g;

-- Insert a PENDING_EVALUATION dispatch with bypass_limits=true
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key,
  status, scheduled_for, bypass_limits
)
select
  f.bypass_dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'PENDING_EVALUATION'::message_dispatcher.message_dispatch_status,
  now(),
  true
from _eval_bypass_fixture f;

select ok(
  message_dispatcher.message_dispatcher_evaluate_pending() >= 1,
  'evaluate_pending processes at least one row'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _eval_bypass_fixture f on d.id = f.bypass_dispatch_id
  ),
  'QUEUED',
  'bypass_limits dispatch becomes QUEUED (not FAILED_TERMINAL)'
);

select isnt(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _eval_bypass_fixture f on d.id = f.bypass_dispatch_id
  ),
  'FAILED_TERMINAL',
  'bypass_limits dispatch is not FAILED_TERMINAL'
);

select * from finish();

rollback;
