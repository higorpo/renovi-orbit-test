-- pgTAP: matching_open_batch orchestration (matching M10b).

begin;

select plan(5);

create or replace function pg_temp.matching_seed_open_service_request(
  p_location extensions.geography default null
)
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
    urgency,
    location
  )
  select
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'matching open batch pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency,
    coalesce(
      p_location,
      (
        select location
        from public.service_requests
        where id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
      )
    )
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create temp table _open_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

create temp table _open_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _open_sr);

select public.matching_open_batch((select dispatch_id from _open_dispatch));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _open_dispatch)
  ),
  'DISPATCH_ACTIVE',
  'batch #1 transitions PENDING to ACTIVE'
);

select ok(
  (
    select count(*)::int
    from public.service_request_dispatch_batch_providers bp
    join public.service_request_dispatch_batches b on b.id = bp.batch_id
    where b.dispatch_id = (select dispatch_id from _open_dispatch)
  ) between 1 and public.platform_constant_int('matching.batch_size', 10),
  'partial batch accepts between 1 and batch_size providers'
);

select is(
  (
    select count(*)::int
    from public.service_request_provider_visibility v
    where v.service_request_id = (select service_request_id from _open_sr)
      and v.source = 'batch'
      and v.revoked_at is null
  ),
  (
    select count(*)::int
    from public.service_request_dispatch_batch_providers bp
    join public.service_request_dispatch_batches b on b.id = bp.batch_id
    where b.dispatch_id = (select dispatch_id from _open_dispatch)
  ),
  'one active batch visibility row per batch provider'
);

select ok(
  (
    select b.explored_h3_cells is not null
      and jsonb_typeof(b.explored_h3_cells) = 'array'
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _open_dispatch)
  ),
  'explored_h3_cells jsonb array is populated on batch row'
);

create temp table _exhaust_sr as
select pg_temp.matching_seed_open_service_request(
  extensions.st_setsrid(extensions.st_makepoint(-45.0, -45.0), 4326)::extensions.geography
) as service_request_id;

update public.service_requests sr
set service_id = 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a61'::uuid
where sr.id = (select service_request_id from _exhaust_sr);

create temp table _exhaust_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _exhaust_sr);

select public.matching_open_batch((select dispatch_id from _exhaust_dispatch));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _exhaust_dispatch)
  ),
  'DISPATCH_FALLBACK_OPEN_MARKET',
  'zero candidates triggers pool exhaustion fallback'
);

select finish();

rollback;
