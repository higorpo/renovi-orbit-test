-- Matching M4 — provider_latest_locations aggregate + beacon refresh trigger (design §3.5, requirements Req 1/3/9/12).

create table public.provider_latest_locations (
  provider_id uuid primary key references public.profiles (id) on delete cascade,
  location extensions.geography (point, 4326),
  h3_index bigint,
  device_id text,
  location_recorded_at timestamptz,
  location_accuracy_meters numeric,
  updated_at timestamptz not null default now()
);

comment on table public.provider_latest_locations is
  'Denormalized latest valid provider location for matching discovery; maintained by beacon upsert trigger.';
comment on column public.provider_latest_locations.h3_index is
  'H3 cell at matching.h3_resolution when h3 extension is available; null otherwise.';
comment on column public.provider_latest_locations.device_id is
  'Originating user_device_beacons.device_id for the selected location sample.';

create index provider_latest_locations_location_gist
  on public.provider_latest_locations using gist (location);

create index provider_latest_locations_h3_idx
  on public.provider_latest_locations (h3_index)
  where h3_index is not null;

create index user_device_beacons_profile_location_fresh_idx
  on public.user_device_beacons (profile_id, location_recorded_at desc)
  where location_permission_granted = true
    and location is not null
    and location_recorded_at is not null;

alter table public.provider_latest_locations enable row level security;

create trigger provider_latest_locations_updated_at
  before update on public.provider_latest_locations
  for each row
  execute procedure public.set_updated_at();

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
  if p_location is null then
    return null;
  end if;

  begin
    execute 'select extensions.h3_latlng_to_cell($1::extensions.geography, $2)::bigint'
      into v_h3_index
      using p_location, p_resolution;
  exception
    when others then
      v_h3_index := null;
  end;

  return v_h3_index;
end;
$$;

comment on function public.matching_latlng_to_h3_cell(extensions.geography, int) is
  'Best-effort H3 cell index; returns null when h3 extension is unavailable.';

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
    udb.location_accuracy_meters
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
    public.matching_latlng_to_h3_cell(v_beacon.location, v_h3_res),
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

comment on function public.matching_refresh_provider_latest_location(uuid) is
  'Recomputes provider_latest_locations from freshest permitted beacon within freshness window.';

revoke all on function public.matching_latlng_to_h3_cell(extensions.geography, int)
  from public, anon, authenticated;
revoke all on function public.matching_refresh_provider_latest_location(uuid)
  from public, anon, authenticated;
grant execute on function public.matching_refresh_provider_latest_location(uuid) to service_role;

create or replace function public.trg_user_device_beacon_refresh_provider_location()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.matching_refresh_provider_latest_location(coalesce(new.profile_id, old.profile_id));
  return coalesce(new, old);
end;
$$;

comment on function public.trg_user_device_beacon_refresh_provider_location() is
  'AFTER INSERT/UPDATE on user_device_beacons: refresh provider_latest_locations in same transaction.';

revoke all on function public.trg_user_device_beacon_refresh_provider_location()
  from public, anon, authenticated;

drop trigger if exists trg_user_device_beacon_refresh_provider_location on public.user_device_beacons;
create trigger trg_user_device_beacon_refresh_provider_location
  after insert or update on public.user_device_beacons
  for each row
  execute procedure public.trg_user_device_beacon_refresh_provider_location();
