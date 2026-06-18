-- pgTAP: matching_force_release_stale_leases janitor (matching task 46).

begin;

select plan(5);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'matching_force_release_stale_leases'
  ),
  'matching_force_release_stale_leases is SECURITY DEFINER'
);

select ok(
  has_function_privilege('service_role', 'public.matching_force_release_stale_leases(interval, int)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.matching_force_release_stale_leases(interval, int)', 'EXECUTE'),
  'service_role only may execute matching_force_release_stale_leases'
);

create or replace function pg_temp.matching_seed_open_service_request()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
  insert into public.service_requests (
    client_id,
    service_id,
    address_id,
    title,
    description,
    form_data,
    form_version,
    status,
    urgency
  )
  select
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'matching stale lease pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create temp table _stale_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

create temp table _stale_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _stale_sr);

update public.service_request_dispatches
set
  lease_owner = 'matching_cron:999',
  lease_expires_at = now() - interval '15 minutes'
where id = (select dispatch_id from _stale_dispatch);

select is(
  (public.matching_force_release_stale_leases(interval '10 minutes', 100)->>'released_count')::int,
  1,
  'releases dispatch with lease_expires_at older than cutoff'
);

select ok(
  (
    select d.lease_owner is null and d.lease_expires_at is null
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _stale_dispatch)
  ),
  'clears lease_owner and lease_expires_at on released row'
);

create temp table _fresh_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

create temp table _fresh_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _fresh_sr);

update public.service_request_dispatches
set
  lease_owner = 'matching_cron:1000',
  lease_expires_at = now() + interval '5 minutes'
where id = (select dispatch_id from _fresh_dispatch);

select is(
  (public.matching_force_release_stale_leases(interval '10 minutes', 100)->>'released_count')::int,
  0,
  'does not release dispatch with active non-expired lease'
);

select finish();

rollback;
