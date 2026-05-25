-- pgTAP: evaluate_pending moves PENDING_EVALUATION to QUEUED (task 34, Req.4 AC1).

begin;

select plan(2);

create temp table _eval_fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _eval_fixture
on conflict (profile_id) do nothing;

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
  'PENDING_EVALUATION'::message_dispatcher.message_dispatch_status,
  now()
from _eval_fixture f;

select is(
  message_dispatcher.message_dispatcher_evaluate_pending(),
  1,
  'evaluates one pending row'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _eval_fixture f on d.id = f.dispatch_id
  ),
  'QUEUED',
  'pending row becomes QUEUED when under quota'
);

select finish();

rollback;
