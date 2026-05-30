-- pgTAP: domain_events_release_stale_leases janitor (design §6.4, task 47, R27-AC02).

begin;

select plan(7);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'domain_events_release_stale_leases'
  ),
  'domain_events_release_stale_leases is SECURITY DEFINER'
);

select ok(
  has_function_privilege('service_role', 'public.domain_events_release_stale_leases()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.domain_events_release_stale_leases()', 'EXECUTE'),
  'service_role only may execute domain_events_release_stale_leases'
);

create temp table _stale_lease_fixture as
select
  gen_random_uuid() as expired_event_id,
  gen_random_uuid() as orphaned_event_id,
  gen_random_uuid() as active_event_id,
  gen_random_uuid() as dead_letter_event_id;

insert into public.domain_events (
  id,
  event_type,
  aggregate_type,
  aggregate_id,
  locked_until,
  locked_by
)
select
  f.expired_event_id,
  'CHAT_MESSAGE_SENT',
  'chat_message',
  gen_random_uuid(),
  now() - interval '2 hours',
  'worker-dead'
from _stale_lease_fixture f;

insert into public.domain_events (
  id,
  event_type,
  aggregate_type,
  aggregate_id,
  locked_until,
  locked_by
)
select
  f.orphaned_event_id,
  'PROPOSAL_SUBMITTED',
  'provider_proposal',
  gen_random_uuid(),
  null,
  'worker-orphaned'
from _stale_lease_fixture f;

insert into public.domain_events (
  id,
  event_type,
  aggregate_type,
  aggregate_id,
  locked_until,
  locked_by
)
select
  f.active_event_id,
  'CHAT_MESSAGE_SENT',
  'chat_message',
  gen_random_uuid(),
  now() + interval '30 seconds',
  'worker-active'
from _stale_lease_fixture f;

insert into public.domain_events (
  id,
  event_type,
  aggregate_type,
  aggregate_id,
  locked_until,
  locked_by,
  dead_letter,
  dead_letter_at
)
select
  f.dead_letter_event_id,
  'CHAT_MESSAGE_SENT',
  'chat_message',
  gen_random_uuid(),
  now() - interval '2 hours',
  'worker-dead',
  true,
  now()
from _stale_lease_fixture f;

select is(
  public.domain_events_release_stale_leases(),
  2,
  'releases expired lease and orphaned locked_by rows'
);

select is(
  (
    select de.locked_until is null and de.locked_by is null
    from public.domain_events de
    join _stale_lease_fixture f on de.id = f.expired_event_id
  ),
  true,
  'expired lease row cleared'
);

select is(
  (
    select de.locked_until is null and de.locked_by is null
    from public.domain_events de
    join _stale_lease_fixture f on de.id = f.orphaned_event_id
  ),
  true,
  'orphaned locked_by row cleared'
);

select ok(
  (
    select de.locked_by = 'worker-active'
      and de.locked_until > now()
    from public.domain_events de
    join _stale_lease_fixture f on de.id = f.active_event_id
  ),
  'active lease not reclaimed'
);

select ok(
  (
    select de.locked_by = 'worker-dead'
      and de.locked_until < now()
    from public.domain_events de
    join _stale_lease_fixture f on de.id = f.dead_letter_event_id
  ),
  'dead_letter row not reclaimed'
);

select finish();

rollback;
