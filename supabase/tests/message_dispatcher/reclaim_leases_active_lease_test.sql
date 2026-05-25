-- pgTAP: reclaim_leases does NOT reclaim active (non-expired) leases (negative test).

begin;

select plan(3);

create temp table _active_lease_fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

-- Active lease: locked_until is in the future
insert into message_dispatcher.message_dispatches (
  id, idempotency_key, profile_id, channel, template_key, status,
  locked_until, locked_by, retry_count, max_retries
)
select
  f.dispatch_id, gen_random_uuid(), f.profile_id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now() + interval '30 seconds',
  'worker-active',
  0, 3
from _active_lease_fixture f;

select is(
  message_dispatcher.message_dispatcher_reclaim_leases(),
  0,
  'active lease not reclaimed (0 returned)'
);

select is(
  (select d.status::text from message_dispatcher.message_dispatches d
   join _active_lease_fixture f on d.id = f.dispatch_id),
  'PROCESSING',
  'dispatch remains PROCESSING'
);

select is(
  (select d.locked_by from message_dispatcher.message_dispatches d
   join _active_lease_fixture f on d.id = f.dispatch_id),
  'worker-active',
  'locked_by unchanged'
);

select finish();

rollback;
