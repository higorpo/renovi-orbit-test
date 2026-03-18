-- Provider service area: many-to-many between provider and neighborhoods.
-- A provider can act in multiple cities by selecting neighborhoods from different cities.
-- Public profile service-area fields are derived from this relation.

create table if not exists public.provider_service_area_neighborhoods (
  provider_id uuid not null references public.provider_profiles_public (provider_id) on delete cascade,
  neighborhood_id uuid not null references public.platform_neighborhoods (id) on delete cascade,
  primary key (provider_id, neighborhood_id)
);

comment on table public.provider_service_area_neighborhoods is 'Neighborhoods where the provider operates; used for search and display.';
comment on column public.provider_service_area_neighborhoods.provider_id is 'Reference to provider_profiles_public.';
comment on column public.provider_service_area_neighborhoods.neighborhood_id is 'Reference to platform_neighborhoods.';

create index if not exists provider_service_area_neighborhoods_provider_id_idx
  on public.provider_service_area_neighborhoods (provider_id);
create index if not exists provider_service_area_neighborhoods_neighborhood_id_idx
  on public.provider_service_area_neighborhoods (neighborhood_id);

alter table public.provider_service_area_neighborhoods enable row level security;

-- Read: provider sees own; anyone can see rows when profile is public; authenticated users when restricted.
create policy "Provider or public profile can read provider_service_area_neighborhoods"
  on public.provider_service_area_neighborhoods for select
  using (
    auth.uid() = provider_id
    or exists (
      select 1 from public.provider_profiles_public p
      where p.provider_id = provider_service_area_neighborhoods.provider_id
        and (p.profile_visibility = 'public' or (p.profile_visibility = 'restricted' and auth.role() = 'authenticated'))
    )
  );

-- Write: only the provider.
create policy "Provider can insert own provider_service_area_neighborhoods"
  on public.provider_service_area_neighborhoods for insert
  with check (auth.uid() = provider_id);

create policy "Provider can delete own provider_service_area_neighborhoods"
  on public.provider_service_area_neighborhoods for delete
  using (auth.uid() = provider_id);
