-- pgTAP: evaluate_pending releases one push per profile per cycle; siblings stay SCHEDULED.

begin;

select plan(4);

create temp table _eval_stagger_fixture as
select
  p.id as profile_id,
  gen_random_uuid() as id_a,
  gen_random_uuid() as id_b,
  gen_random_uuid() as id_c
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _eval_stagger_fixture
on conflict (profile_id) do nothing;

insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status, scheduled_for, created_at
)
select
  f.id_a,
  gen_random_uuid(),
  f.profile_id,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  'PENDING_EVALUATION'::message_dispatcher.message_dispatch_status,
  now() - interval '1 minute',
  now() - interval '3 minutes'
from _eval_stagger_fixture f
union all
select
  f.id_b,
  gen_random_uuid(),
  f.profile_id,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  'PENDING_EVALUATION'::message_dispatcher.message_dispatch_status,
  now() - interval '1 minute',
  now() - interval '2 minutes'
from _eval_stagger_fixture f
union all
select
  f.id_c,
  gen_random_uuid(),
  f.profile_id,
  'push'::message_dispatcher.message_channel,
  'engagement_push',
  'PENDING_EVALUATION'::message_dispatcher.message_dispatch_status,
  now() - interval '1 minute',
  now() - interval '1 minute'
from _eval_stagger_fixture f;

select is(
  message_dispatcher.message_dispatcher_evaluate_pending(),
  3,
  'evaluates three pending push rows'
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches d
    join _eval_stagger_fixture f on d.profile_id = f.profile_id
    where d.status = 'QUEUED'::message_dispatcher.message_dispatch_status
      and d.channel = 'push'
  ),
  1,
  'only one push becomes QUEUED per profile per evaluate cycle'
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches d
    join _eval_stagger_fixture f on d.profile_id = f.profile_id
    where d.status = 'SCHEDULED'::message_dispatcher.message_dispatch_status
      and d.channel = 'push'
  ),
  2,
  'remaining pushes stay SCHEDULED with staggered slots'
);

select ok(
  (
    select count(distinct d.scheduled_for)::int = 2
    from message_dispatcher.message_dispatches d
    join _eval_stagger_fixture f on d.profile_id = f.profile_id
    where d.status = 'SCHEDULED'::message_dispatcher.message_dispatch_status
      and d.channel = 'push'
  ),
  'scheduled siblings have distinct future scheduled_for values'
);

select finish();

rollback;
