-- Client addresses: one client can have multiple addresses.
-- Used in request-quote and profile; no address data stored on profiles.
-- PostGIS required for geography column.
create extension if not exists postgis;

create table if not exists public.client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Casa',
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  zip_code text not null,
  state_id uuid not null references public.platform_states (id) on delete restrict,
  city_id uuid not null references public.platform_cities (id) on delete restrict,
  is_default boolean not null default false,
  is_active boolean not null default true,
  -- Single source of truth for coordinates (WGS84). Set via ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography.
  location geography(Point, 4326),
  -- Derived from location for convenience (API, simple queries). Read-only.
  latitude double precision generated always as (st_y(location::geometry)) stored,
  longitude double precision generated always as (st_x(location::geometry)) stored,
  -- Geohash derived from location (precision 7 ~ 150m). Used for spatial indexing/clustering.
  geohash text generated always as (st_geohash(location::geometry, 7)) stored,
  -- H3 cell index (Uber) at resolution 9; computed in app (no native H3 in Postgres). Used for spatial indexing/clustering.
  h3_index text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.client_addresses is 'Client addresses; one client can have multiple.';
comment on column public.client_addresses.client_id is 'References profiles.id (client).';
comment on column public.client_addresses.is_default is 'When true, used as default for new requests.';
comment on column public.client_addresses.state_id is 'Reference to platform_states.';
comment on column public.client_addresses.city_id is 'Reference to platform_cities.';
comment on column public.client_addresses.location is 'PostGIS point (SRID 4326). Single source of truth; set from coordinates when inserting/updating.';
comment on column public.client_addresses.latitude is 'WGS84 latitude, derived from location.';
comment on column public.client_addresses.longitude is 'WGS84 longitude, derived from location.';
comment on column public.client_addresses.geohash is 'Geohash (precision 7) derived from location for filtering and clustering.';
comment on column public.client_addresses.h3_index is 'H3 cell index (Uber) at resolution 9, derived from location in app. Used for spatial indexing and clustering.';

create index if not exists client_addresses_client_id_idx on public.client_addresses (client_id);
create index if not exists client_addresses_state_id_idx on public.client_addresses (state_id);
create index if not exists client_addresses_city_id_idx on public.client_addresses (city_id);
create index if not exists idx_client_addresses_location on public.client_addresses using gist (location);
create index if not exists idx_client_addresses_geohash on public.client_addresses (geohash) where geohash is not null;
create index if not exists idx_client_addresses_h3_index on public.client_addresses (h3_index) where h3_index is not null;

alter table public.client_addresses enable row level security;

create policy "Clients can read own addresses"
  on public.client_addresses for select
  using (auth.uid() = client_id);

create policy "Clients can insert own addresses"
  on public.client_addresses for insert
  with check (auth.uid() = client_id);

create policy "Clients can update own addresses"
  on public.client_addresses for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

-- Clients cannot delete own addresses (no delete policy).

create trigger client_addresses_updated_at
  before update on public.client_addresses
  for each row execute procedure public.set_updated_at();
