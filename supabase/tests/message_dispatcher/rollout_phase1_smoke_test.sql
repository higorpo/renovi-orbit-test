-- pgTAP: Phase 1 rollout smoke (design §13.1, task 119).

begin;

select plan(7);

select ok(
  exists (
    select 1 from cron.job j
    where j.jobname = 'mmd_activate_scheduled' and j.active = true
  ),
  'mmd_activate_scheduled cron is active'
);

select ok(
  exists (
    select 1 from cron.job j
    where j.jobname = 'mmd_promote_retries' and j.active = true
  ),
  'mmd_promote_retries cron is active'
);

select ok(
  exists (
    select 1 from cron.job j
    where j.jobname = 'mmd_reclaim_leases' and j.active = true
  ),
  'mmd_reclaim_leases cron is active'
);

create temp table _phase1_fixture as
select p.id as profile_id, gen_random_uuid() as ingest_key
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select profile_id from _phase1_fixture
on conflict (profile_id) do nothing;

select ok(
  (
    select (message_dispatcher.message_dispatcher_ingest(
      (select ingest_key from _phase1_fixture),
      (select profile_id from _phase1_fixture),
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      '{"name":"Phase1"}'::jsonb,
      now(),
      'mmd_smoke_test',
      '{}'::jsonb
    )->>'dispatch_id') is not null
  ),
  'ingest with source_system mmd_smoke_test returns dispatch_id'
);

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
  gen_random_uuid(),
  gen_random_uuid(),
  profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'SCHEDULED'::message_dispatcher.message_dispatch_status,
  now() + interval '1 day'
from _phase1_fixture;

select is(
  (
    select count(*)::integer
    from message_dispatcher.message_dispatcher_checkout_batch(25, 'worker-phase1-smoke') c
    join message_dispatcher.message_dispatches d
      on d.id = (c->>'id')::uuid
    where d.status = 'SCHEDULED'
      and d.scheduled_for > now()
  ),
  0,
  'future SCHEDULED rows are not returned by checkout_batch'
);

select lives_ok(
  $$select message_dispatcher.message_dispatcher_activate_scheduled()$$,
  'activate_scheduled runs'
);

select lives_ok(
  $$select message_dispatcher.message_dispatcher_reclaim_leases()$$,
  'reclaim_leases runs'
);

select finish();

rollback;
