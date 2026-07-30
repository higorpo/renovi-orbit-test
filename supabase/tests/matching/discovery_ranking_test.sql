-- pgTAP: discovery + ranking comprehensive suite (matching task 42).

begin;

select plan(8);

-- Clear leftover visibility from seeds/crons for seed SR + fixture pairs used below.
delete from public.service_request_provider_visibility
where (
    service_request_id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
    and provider_id in (
      '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
      '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
    )
  )
  or (
    service_request_id = '8017e001-5a32-44e7-b8da-1727a14f4d01'::uuid
    and provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  );

create or replace function pg_temp.discovery_seed_sr(p_location extensions.geography)
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
    'discovery ranking pgTAP fixture',
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

create or replace function pg_temp.discovery_upsert_beacon(
  p_provider_id uuid,
  p_location extensions.geography,
  p_device_id text default 'pgtap-beacon'
)
returns void
language sql
as $$
  insert into public.provider_latest_locations (
    provider_id,
    location,
    location_recorded_at,
    device_id
  )
  values (
    p_provider_id,
    p_location,
    now(),
    p_device_id
  )
  on conflict (provider_id) do update
  set
    location = excluded.location,
    location_recorded_at = excluded.location_recorded_at,
    device_id = excluded.device_id,
    updated_at = now();
$$;

create temp table _disc_base as
select
  (
    select location
    from public.service_requests
    where id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  ) as sr_location;

create temp table _disc_sr as
select pg_temp.discovery_seed_sr((select sr_location from _disc_base)) as service_request_id;

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

update public.profiles
set operational_status = 'active'::public.provider_operational_status
where id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid;

select pg_temp.discovery_upsert_beacon(
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  (select sr_location from _disc_base),
  'near-beacon'
);

select ok(
  exists (
    select 1
    from public.matching_discover_candidates((select service_request_id from _disc_sr)) d
    where d.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
      and d.has_valid_beacon = true
      and d.distance_meters <= 20000
  ),
  'includes beacon provider within 20km'
);

select pg_temp.discovery_upsert_beacon(
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  extensions.st_project(
    (select sr_location from _disc_base),
    25000,
    0
  ),
  'far-beacon'
);

delete from public.provider_service_area_neighborhoods
where provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid;

select ok(
  not exists (
    select 1
    from public.matching_discover_candidates((select service_request_id from _disc_sr)) d
    where d.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
  ),
  'excludes beacon provider beyond 20km'
);

delete from public.provider_latest_locations
where provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;

create temp table _neighborhood_sr as
select pg_temp.discovery_seed_sr((select sr_location from _disc_base)) as service_request_id;

select ok(
  exists (
    select 1
    from public.matching_discover_candidates((select service_request_id from _neighborhood_sr)) d
    where d.provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      and d.has_valid_beacon = false
  ),
  'neighborhood path includes provider without valid beacon'
);

create temp table _rank_sr as
select '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid as service_request_id;

insert into public.service_request_provider_visibility (
  service_request_id,
  provider_id,
  source,
  granted_at
)
values (
  (select service_request_id from _rank_sr),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'batch',
  now() - interval '1 hour'
);

select is(
  (
    select r.provider_id
    from public.matching_rank_candidates(
      (select service_request_id from _rank_sr),
      array[
        '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
        '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      ]
    ) r
    limit 1
  ),
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  'tie-break prefers lower batch exposure when scores align'
);

select lives_ok(
  $$
  insert into public.service_request_provider_visibility (
    service_request_id,
    provider_id,
    source,
    granted_at
  )
  values (
    '8017e001-5a32-44e7-b8da-1727a14f4d01'::uuid,
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'batch',
    now()
  )
  $$,
  'first active batch visibility row inserts'
);

select throws_ok(
  $$
  insert into public.service_request_provider_visibility (
    service_request_id,
    provider_id,
    source,
    granted_at
  )
  values (
    '8017e001-5a32-44e7-b8da-1727a14f4d01'::uuid,
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'batch',
    now()
  )
  $$,
  '23505',
  null,
  'duplicate active batch visibility raises unique_violation'
);

select finish();

rollback;
