-- pgTAP: matching_discover_candidates eligibility (matching M9a).

begin;

select plan(3);

create or replace function pg_temp.matching_seed_discovery_sr(
  p_location extensions.geography
)
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid := gen_random_uuid();
begin
  insert into public.service_requests (
    id,
    client_id,
    service_id,
    address_id,
    title,
    description,
    form_data,
    form_version,
    status,
    urgency,
    location
  )
  select
    v_sr_id,
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'matching discovery pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency,
    p_location
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  return v_sr_id;
end;
$$;

create temp table _disc_sr as
select pg_temp.matching_seed_discovery_sr(
  (
    select location
    from public.service_requests
    where id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  )
) as service_request_id;

insert into public.service_request_provider_visibility (
  service_request_id,
  provider_id,
  source,
  granted_at
)
values (
  (select service_request_id from _disc_sr),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'batch',
  now()
);

select ok(
  not exists (
    select 1
    from public.matching_discover_candidates((select service_request_id from _disc_sr)) d
    where d.provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ),
  'excludes providers with active batch visibility'
);

update public.profiles
set operational_status = 'suspended'::public.provider_operational_status
where id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid;

select ok(
  not exists (
    select 1
    from public.matching_discover_candidates((select service_request_id from _disc_sr)) d
    where d.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
  ),
  'excludes suspended providers'
);

select ok(
  (
    select count(*) <= 200
    from public.matching_discover_candidates((select service_request_id from _disc_sr), 500)
  ),
  'clamps discovery pool to 200 providers'
);

select finish();

rollback;
