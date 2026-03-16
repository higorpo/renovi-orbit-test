-- Service requests: quote requests created by clients.
-- Links client, service (or sub-service), optional address, and form data.
-- City/neighborhood come from address_id -> client_addresses. Location/geohash are synced from client_addresses for list-by-region queries.

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  address_id uuid references public.client_addresses (id) on delete set null,
  title text not null,
  description text,
  photos text[],
  form_data jsonb,
  form_schema jsonb,
  form_version text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed', 'cancelled')),
  urgency text check (urgency is null or urgency in ('low', 'medium', 'high')),
  scope_complexity text check (scope_complexity is null or scope_complexity in ('simple', 'medium', 'complex')),
  suggested_questions text[],
  tags text[],
  missing_info_warnings text[],
  suggested_equipment text[],
  suggested_materials text[],
  estimated_duration_hint text check (
    estimated_duration_hint is null
    or estimated_duration_hint in (
      'under_1h', '1_to_2h', '2_to_4h', '4_to_8h',
      '1_day', '1_to_2_days', '2_to_5_days', '5_to_10_days', 'over_10_days'
    )
  ),
  -- Snapshot of address coordinates at request creation; synced from client_addresses when address_id is set (trigger).
  location geography(Point, 4326),
  latitude double precision generated always as (st_y(location::geometry)) stored,
  longitude double precision generated always as (st_x(location::geometry)) stored,
  geohash text generated always as (st_geohash(location::geometry, 7)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.service_requests is 'Quote requests from clients; one per request.';
comment on column public.service_requests.service_id is 'Service or sub-service selected.';
comment on column public.service_requests.address_id is 'Client address for the request; may be null if entered inline.';
comment on column public.service_requests.form_data is 'Dynamic form answers (from DynamicForm).';
comment on column public.service_requests.form_schema is 'Snapshot of the form schema used when the request was created (dynamic-form schema).';
comment on column public.service_requests.form_version is 'Schema version at creation time (e.g. 2.0).';
comment on column public.service_requests.photos is 'Array of storage paths (e.g. userId/timestamp_index.ext) for private bucket; use signed URLs to display.';
comment on column public.service_requests.urgency is 'AI-derived urgency: low, medium, high.';
comment on column public.service_requests.scope_complexity is 'AI-derived scope complexity: simple, medium, complex.';
comment on column public.service_requests.suggested_questions is 'AI-suggested follow-up questions for the client.';
comment on column public.service_requests.tags is 'AI-derived tags for the request.';
comment on column public.service_requests.missing_info_warnings is 'AI warnings about missing or unclear information.';
comment on column public.service_requests.suggested_equipment is 'AI-suggested equipment/tools keys (snake_case, from allowed list) the professional may need.';
comment on column public.service_requests.suggested_materials is 'AI-suggested materials/consumables keys (snake_case, from allowed list) typically needed for the job.';
comment on column public.service_requests.estimated_duration_hint is 'AI-derived estimated duration key: under_1h, 1_to_2h, 2_to_4h, 4_to_8h, 1_day, 1_to_2_days, 2_to_5_days, 5_to_10_days, over_10_days.';
comment on column public.service_requests.location is 'Snapshot of address coordinates at request creation; synced from client_addresses when address_id is set. Used for region/geohash queries.';
comment on column public.service_requests.latitude is 'WGS84 latitude derived from location.';
comment on column public.service_requests.longitude is 'WGS84 longitude derived from location.';
comment on column public.service_requests.geohash is 'Geohash (precision 7) derived from location for list-by-region queries.';

create index if not exists service_requests_client_id_idx on public.service_requests (client_id);
create index if not exists service_requests_service_id_idx on public.service_requests (service_id);
create index if not exists service_requests_status_idx on public.service_requests (status);
create index if not exists idx_service_requests_geohash on public.service_requests (geohash) where geohash is not null;
create index if not exists idx_service_requests_status_geohash on public.service_requests (status, geohash) where geohash is not null and status = 'open';

-- Sync location from client_addresses when address_id is set (insert or update).
create or replace function public.sync_service_request_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.address_id is not null then
    select ca.location into new.location
    from public.client_addresses ca
    where ca.id = new.address_id;
  else
    new.location := null;
  end if;
  return new;
end;
$$;

comment on function public.sync_service_request_location() is 'Copies client_addresses.location into service_requests.location when address_id is set.';

create trigger service_requests_sync_location
  before insert or update of address_id on public.service_requests
  for each row execute function public.sync_service_request_location();

alter table public.service_requests enable row level security;

create policy "Clients can insert own service requests"
  on public.service_requests for insert
  with check (auth.uid() = client_id);

create policy "Clients read own; providers and admins read all"
  on public.service_requests for select
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'provider'))
  );

create policy "Clients can update own service requests; admins can update any"
  on public.service_requests for update
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    auth.uid() = client_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger service_requests_updated_at
  before update on public.service_requests
  for each row execute procedure public.set_updated_at();
