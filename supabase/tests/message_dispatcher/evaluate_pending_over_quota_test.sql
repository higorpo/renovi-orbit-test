-- pgTAP: evaluate_pending when over email quota → FAILED_TERMINAL (design §4.2).

begin;

select plan(4);

create temp table _eval_quota_fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _eval_quota_fixture
on conflict (profile_id) do nothing;

-- Fill 5 email dispatches (at the default limit)
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
from _eval_quota_fixture f,
  generate_series(1, 5) g;

-- Insert a PENDING_EVALUATION dispatch that should fail quota
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status, scheduled_for
)
select
  f.dispatch_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'PENDING_EVALUATION'::message_dispatcher.message_dispatch_status,
  now()
from _eval_quota_fixture f;

select is(
  message_dispatcher.message_dispatcher_evaluate_pending(),
  1,
  'evaluates one pending row'
);

select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _eval_quota_fixture f on d.id = f.dispatch_id),
  'FAILED_TERMINAL',
  'over-quota pending row becomes FAILED_TERMINAL'
);

select is(
  (select d.failure_code from message_dispatcher.message_dispatches d
   join _eval_quota_fixture f on d.id = f.dispatch_id),
  'email_daily_quota_exceeded',
  'failure_code set to email_daily_quota_exceeded'
);

select ok(
  (select (d.metadata -> 'rate_limit' ->> 'limit')::int = 5
   from message_dispatcher.message_dispatches d
   join _eval_quota_fixture f on d.id = f.dispatch_id),
  'metadata.rate_limit.limit recorded'
);

select finish();

rollback;
