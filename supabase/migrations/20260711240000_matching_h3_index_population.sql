-- Populate and maintain h3_index columns (addresses, service_requests, provider_latest_locations).
-- Root cause: h3-pg is not bundled in Supabase Postgres; matching_latlng_to_h3_cell silently returned null.
-- This migration adds portable H3 index parsing/parent helpers (h3-js hex + decimal bigint), optional h3
-- extension enablement, trigger fixes, and backfill for existing rows with location.

do $$
begin
  create extension if not exists h3 with schema extensions;
exception
  when others then
    raise notice 'h3 extension unavailable (%); lat/lng indexing falls back to app-provided cells', sqlerrm;
end;
$$;

create or replace function public.matching_h3_hex_to_bigint(p_hex text)
returns bigint
language plpgsql
immutable
set search_path = public
as $$
declare
  v_hex text;
begin
  v_hex := lower(btrim(p_hex));
  if v_hex is null or v_hex = '' or v_hex !~ '^[0-9a-f]+$' then
    return null;
  end if;

  return ('x' || lpad(v_hex, 16, '0'))::bit(64)::bigint;
end;
$$;

comment on function public.matching_h3_hex_to_bigint(text) is
  'Converts h3-js hex cell string (upper||lower 32-bit limbs) to uint64 bigint.';

create or replace function public.matching_h3_bigint_to_hex(p_cell bigint)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_lower bigint;
  v_upper bigint;
begin
  if p_cell is null then
    return null;
  end if;

  v_lower := p_cell & 4294967295;
  v_upper := (p_cell >> 32) & 4294967295;
  return ltrim(to_hex(v_upper), '0') || lpad(to_hex(v_lower), 8, '0');
end;
$$;

comment on function public.matching_h3_bigint_to_hex(bigint) is
  'Converts uint64 H3 cell to h3-js hex string format.';

create or replace function public.matching_h3_parse_index(p_index text)
returns bigint
language plpgsql
immutable
set search_path = public
as $$
declare
  v_text text;
begin
  v_text := btrim(p_index);
  if v_text is null or v_text = '' then
    return null;
  end if;

  if v_text ~ '^[0-9]+$' then
    return v_text::bigint;
  end if;

  if v_text ~ '^[0-9a-fA-F]+$' then
    return public.matching_h3_hex_to_bigint(v_text);
  end if;

  return null;
end;
$$;

comment on function public.matching_h3_parse_index(text) is
  'Parses H3 cell from decimal bigint text (Postgres h3-pg) or h3-js hex text.';

create or replace function public.matching_h3_cell_to_parent(
  p_cell bigint,
  p_parent_res int
)
returns bigint
language plpgsql
immutable
set search_path = public
as $$
declare
  v_cell bigint;
  v_mode int;
  v_res int;
  v_r int;
  v_shift int;
begin
  if p_cell is null or p_parent_res is null or p_parent_res < 0 or p_parent_res > 15 then
    return null;
  end if;

  v_cell := p_cell;
  v_mode := ((v_cell >> 59) & 31)::int;
  if v_mode <> 1 then
    return null;
  end if;

  v_res := ((v_cell >> 52) & 15)::int;
  if p_parent_res > v_res then
    return null;
  end if;

  v_cell := (v_cell & ~(15::bigint << 52)) | (p_parent_res::bigint << 52);

  for v_r in (p_parent_res + 1)..v_res loop
    v_shift := 45 - (3 * v_r);
    v_cell := (v_cell & ~(7::bigint << v_shift)) | (7::bigint << v_shift);
  end loop;

  return v_cell;
end;
$$;

comment on function public.matching_h3_cell_to_parent(bigint, int) is
  'H3 v4 parent cell at target resolution using uint64 bit layout (no h3 extension required).';

create or replace function public.matching_h3_cell_at_matching_resolution(
  p_address_h3 text,
  p_location extensions.geography
)
returns bigint
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_matching_res int;
  v_parsed bigint;
  v_cell bigint;
begin
  v_matching_res := public.platform_constant_int('matching.h3_resolution', 7);

  if p_address_h3 is not null then
    v_parsed := public.matching_h3_parse_index(p_address_h3);
    if v_parsed is not null then
      v_cell := public.matching_h3_cell_to_parent(v_parsed, v_matching_res);
      if v_cell is not null then
        return v_cell;
      end if;
    end if;
  end if;

  return public.matching_latlng_to_h3_cell(p_location, v_matching_res);
end;
$$;

comment on function public.matching_h3_cell_at_matching_resolution(text, extensions.geography) is
  'Derives matching-resolution H3 cell from address h3 (any res) or lat/lng when h3 extension is available.';

create or replace function public.matching_latlng_to_h3_cell(
  p_location extensions.geography,
  p_resolution int
)
returns bigint
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_h3_index bigint;
begin
  if p_location is null or p_resolution is null then
    return null;
  end if;

  begin
    execute 'select extensions.h3_latlng_to_cell($1::extensions.geography, $2)::bigint'
      into v_h3_index
      using p_location, p_resolution;
    if v_h3_index is not null then
      return v_h3_index;
    end if;
  exception
    when undefined_function then
      null;
    when others then
      null;
  end;

  begin
    execute $sql$
      select extensions.h3_lat_lng_to_cell(
        point(extensions.st_x($1::extensions.geometry), extensions.st_y($1::extensions.geometry)),
        $2
      )::bigint
    $sql$
      into v_h3_index
      using p_location::extensions.geometry, p_resolution;
    if v_h3_index is not null then
      return v_h3_index;
    end if;
  exception
    when undefined_function then
      null;
    when others then
      null;
  end;

  return null;
end;
$$;

comment on function public.matching_latlng_to_h3_cell(extensions.geography, int) is
  'Best-effort H3 cell from geography; uses h3-pg when installed, else null (use app-provided cells).';

create or replace function public.trg_client_addresses_sync_h3_index()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_cell bigint;
begin
  if new.location is null then
    new.h3_index := null;
    return new;
  end if;

  if tg_op = 'INSERT'
    or new.h3_index is null
    or old.location is distinct from new.location then
    v_cell := public.matching_latlng_to_h3_cell(new.location, 9);
    if v_cell is not null then
      new.h3_index := public.matching_h3_bigint_to_hex(v_cell);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_client_addresses_sync_h3_index on public.client_addresses;
create trigger trg_client_addresses_sync_h3_index
  before insert or update of location, h3_index on public.client_addresses
  for each row
  execute function public.trg_client_addresses_sync_h3_index();

create or replace function public.sync_service_request_location()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_addr_h3 text;
  v_cell bigint;
begin
  if new.address_id is not null then
    select ca.location, ca.h3_index
    into new.location, v_addr_h3
    from public.client_addresses ca
    where ca.id = new.address_id;

    if new.location is not null then
      v_cell := public.matching_h3_cell_at_matching_resolution(v_addr_h3, new.location);
      new.h3_index := case when v_cell is not null then v_cell::text else null end;
    else
      new.h3_index := null;
    end if;
  else
    new.location := null;
    new.h3_index := null;
  end if;

  return new;
end;
$$;

comment on function public.sync_service_request_location() is
  'Syncs SR location from address; stores matching-resolution H3 as decimal bigint text.';

alter table public.user_device_beacons
  add column if not exists h3_index bigint;

comment on column public.user_device_beacons.h3_index is
  'H3 cell at matching.h3_resolution from client GPS; used for provider_latest_locations when h3-pg is unavailable.';

create or replace function public.matching_refresh_provider_latest_location(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_freshness_hours int;
  v_h3_res int;
  v_beacon record;
  v_h3 bigint;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and p.role = 'provider'
  ) then
    return;
  end if;

  v_freshness_hours := public.platform_constant_int('matching.beacon_location_max_age_hours', 24);
  v_h3_res := public.platform_constant_int('matching.h3_resolution', 7);

  select
    udb.device_id,
    udb.location,
    udb.location_recorded_at,
    udb.location_accuracy_meters,
    udb.h3_index
  into v_beacon
  from public.user_device_beacons udb
  where udb.profile_id = p_profile_id
    and udb.location_permission_granted = true
    and udb.location is not null
    and udb.location_recorded_at is not null
    and udb.location_recorded_at >= now() - (v_freshness_hours || ' hours')::interval
  order by udb.location_recorded_at desc
  limit 1;

  if not found then
    delete from public.provider_latest_locations
    where provider_id = p_profile_id;
    return;
  end if;

  v_h3 := coalesce(
    v_beacon.h3_index,
    public.matching_latlng_to_h3_cell(v_beacon.location, v_h3_res)
  );

  insert into public.provider_latest_locations (
    provider_id,
    location,
    h3_index,
    device_id,
    location_recorded_at,
    location_accuracy_meters,
    updated_at
  )
  values (
    p_profile_id,
    v_beacon.location,
    v_h3,
    v_beacon.device_id,
    v_beacon.location_recorded_at,
    v_beacon.location_accuracy_meters,
    now()
  )
  on conflict (provider_id) do update set
    location = excluded.location,
    h3_index = excluded.h3_index,
    device_id = excluded.device_id,
    location_recorded_at = excluded.location_recorded_at,
    location_accuracy_meters = excluded.location_accuracy_meters,
    updated_at = now();
end;
$$;

create or replace function public.matching_h3_ring_cells(
  p_center_h3 bigint,
  p_resolution int
)
returns setof bigint
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_cell bigint;
begin
  if p_center_h3 is null then
    return;
  end if;

  begin
    for v_cell in
      execute $sql$
        select cell::bigint
        from (
          select unnest(extensions.h3_grid_disk($1::extensions.h3index, 3)) as cell
        ) disk
      $sql$
      using p_center_h3
    loop
      return next v_cell;
    end loop;
  exception
    when others then
      return;
  end;
end;
$$;

create or replace function public.matching_compute_explored_h3_cells(
  p_service_request_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (
      select jsonb_agg(distinct cell::text order by cell::text)
      from public.service_requests sr
      cross join lateral public.matching_h3_ring_cells(
        public.matching_h3_parse_index(sr.h3_index),
        public.platform_constant_int('matching.h3_resolution', 7)
      ) as cell
      where sr.id = p_service_request_id
    ),
    '[]'::jsonb
  );
$$;

create or replace function public.matching_discover_candidates(
  p_service_request_id uuid,
  p_limit int default null
)
returns table (
  provider_id uuid,
  distance_meters numeric,
  has_valid_beacon boolean,
  device_id text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_sr record;
  v_freshness_hours int;
  v_h3_res int;
  v_center_h3 bigint;
  v_radius_m numeric;
  v_pool_cap int;
begin
  v_pool_cap := public.platform_constant_int('matching.discovery_pool_cap', 200);
  p_limit := least(
    greatest(coalesce(p_limit, v_pool_cap), 1),
    v_pool_cap
  );
  v_radius_m := public.platform_constant_numeric('matching.discovery_beacon_radius_meters', 20000);

  select
    sr.id,
    sr.location,
    sr.h3_index,
    sr.service_id,
    pn.id as neighborhood_id
  into v_sr
  from public.service_requests sr
  join public.client_addresses ca on ca.id = sr.address_id
  left join public.platform_neighborhoods pn
    on pn.city_id = ca.city_id
    and lower(trim(pn.name)) = lower(trim(ca.neighborhood))
  where sr.id = p_service_request_id
    and sr.status = 'OPEN'::public.service_request_status;

  if not found then
    return;
  end if;

  v_freshness_hours := public.platform_constant_int('matching.beacon_location_max_age_hours', 24);
  v_h3_res := public.platform_constant_int('matching.h3_resolution', 7);
  v_center_h3 := public.matching_h3_parse_index(v_sr.h3_index);

  return query
  with h3_cells as (
    select cell
    from public.matching_h3_ring_cells(v_center_h3, v_h3_res) as cell
  ),
  excluded as (
    select v.provider_id
    from public.service_request_provider_visibility v
    where v.service_request_id = p_service_request_id
      and v.source = 'batch'
      and v.revoked_at is null
  ),
  beacon_prefilter as (
    select
      pll.provider_id,
      pll.device_id,
      st_distance(pll.location, v_sr.location)::numeric as distance_meters,
      true as has_valid_beacon
    from public.provider_latest_locations pll
    join public.profiles p on p.id = pll.provider_id
    join public.provider_offered_services pos
      on pos.provider_id = p.id
      and pos.service_id = v_sr.service_id
    where p.role = 'provider'
      and p.operational_status = 'active'::public.provider_operational_status
      and pll.location is not null
      and v_sr.location is not null
      and pll.location_recorded_at >= now() - (v_freshness_hours || ' hours')::interval
      and st_dwithin(pll.location, v_sr.location, v_radius_m)
      and not exists (
        select 1 from excluded e where e.provider_id = pll.provider_id
      )
      and (
        not exists (select 1 from h3_cells)
        or pll.h3_index in (select hc.cell from h3_cells hc)
      )
  ),
  neighborhood_prefilter as (
    select
      p.id as provider_id,
      null::text as device_id,
      null::numeric as distance_meters,
      false as has_valid_beacon
    from public.profiles p
    join public.provider_offered_services pos
      on pos.provider_id = p.id
      and pos.service_id = v_sr.service_id
    join public.provider_service_area_neighborhoods psan on psan.provider_id = p.id
    where p.role = 'provider'
      and p.operational_status = 'active'::public.provider_operational_status
      and v_sr.neighborhood_id is not null
      and psan.neighborhood_id = v_sr.neighborhood_id
      and not exists (
        select 1 from excluded e where e.provider_id = p.id
      )
      and not exists (
        select 1 from beacon_prefilter be where be.provider_id = p.id
      )
  ),
  candidate_union as (
    select * from beacon_prefilter
    union all
    select * from neighborhood_prefilter
  ),
  load_cap as (
    select
      cu.provider_id,
      count(cs.id) filter (
        where cs.status = 'PENDING_PAYMENT'::public.contracted_service_status
          and cs.scheduled_start_date is not null
          and cs.scheduled_end_date is not null
          and daterange(cs.scheduled_start_date, cs.scheduled_end_date, '[]')
            && daterange(
              current_date,
              current_date + public.platform_constant_int('matching.provider_load_lookforward_days', 14),
              '[]'
            )
      ) as scheduled_load
    from candidate_union cu
    left join public.contracted_services cs on cs.provider_id = cu.provider_id
    group by cu.provider_id
  ),
  combined as (
    select
      cu.provider_id,
      cu.distance_meters,
      cu.has_valid_beacon,
      cu.device_id
    from candidate_union cu
    join load_cap lc on lc.provider_id = cu.provider_id
    where lc.scheduled_load < public.platform_constant_int('matching.provider_max_scheduled_load', 28)
  )
  select
    c.provider_id,
    c.distance_meters,
    c.has_valid_beacon,
    c.device_id
  from combined c
  order by c.distance_meters nulls last, c.provider_id
  limit p_limit;
end;
$$;

-- Backfill: address h3 (hex res 9) when missing — app/seeds use h3-js; lat/lng indexing needs h3-pg.
update public.client_addresses ca
set h3_index = src.h3_hex
from (
  select
    id,
    public.matching_h3_bigint_to_hex(
      public.matching_latlng_to_h3_cell(location, 9)
    ) as h3_hex
  from public.client_addresses
  where location is not null
    and h3_index is null
) src
where ca.id = src.id
  and src.h3_hex is not null;

update public.service_requests sr
set
  location = ca.location,
  h3_index = (
    select v.cell::text
    from (
      select public.matching_h3_cell_at_matching_resolution(ca.h3_index, ca.location) as cell
    ) v
    where v.cell is not null
  )
from public.client_addresses ca
where sr.address_id = ca.id
  and ca.location is not null
  and (
    sr.h3_index is null
    or public.matching_h3_parse_index(sr.h3_index) is null
  );

do $$
declare
  v_profile_id uuid;
begin
  for v_profile_id in
    select distinct udb.profile_id
    from public.user_device_beacons udb
    where udb.location is not null
      and udb.location_permission_granted = true
  loop
    perform public.matching_refresh_provider_latest_location(v_profile_id);
  end loop;
end;
$$;

revoke all on function public.matching_h3_hex_to_bigint(text)
  from public, anon, authenticated;
revoke all on function public.matching_h3_bigint_to_hex(bigint)
  from public, anon, authenticated;
revoke all on function public.matching_h3_parse_index(text)
  from public, anon, authenticated;
revoke all on function public.matching_h3_cell_to_parent(bigint, int)
  from public, anon, authenticated;
revoke all on function public.matching_h3_cell_at_matching_resolution(text, extensions.geography)
  from public, anon, authenticated;
revoke all on function public.trg_client_addresses_sync_h3_index()
  from public, anon, authenticated;
