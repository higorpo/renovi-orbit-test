-- pgTAP: matching dispatch lease CAS (matching M10a).

begin;

select plan(4);

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
    'matching lease pgTAP fixture',
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

create temp table _lease_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

create temp table _lease_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _lease_sr);

select is(
  public.matching_acquire_dispatch_lease(
    (select dispatch_id from _lease_dispatch),
    'matching_cron:101'
  ),
  true,
  'first acquire wins on unleased dispatch'
);

select is(
  public.matching_acquire_dispatch_lease(
    (select dispatch_id from _lease_dispatch),
    'matching_cron:102'
  ),
  false,
  'second acquire fails while active lease is held'
);

update public.service_request_dispatches
set lease_expires_at = now() - interval '1 minute'
where id = (select dispatch_id from _lease_dispatch);

select is(
  public.matching_acquire_dispatch_lease(
    (select dispatch_id from _lease_dispatch),
    'matching_cron:103'
  ),
  true,
  'expired lease can be re-acquired'
);

select public.matching_release_dispatch_lease((select dispatch_id from _lease_dispatch));

select is(
  (
    select d.lease_owner is null and d.lease_expires_at is null
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _lease_dispatch)
  ),
  true,
  'release clears lease_owner and lease_expires_at'
);

select finish();

rollback;
