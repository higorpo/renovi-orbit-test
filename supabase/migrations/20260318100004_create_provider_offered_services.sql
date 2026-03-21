-- Junction: which services a provider offers. Used for profile display and discovery.

create table if not exists public.provider_offered_services (
  provider_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.platform_services (id) on delete cascade,
  sort_order int not null default 0,
  primary key (provider_id, service_id)
);

comment on table public.provider_offered_services is 'Services offered by each provider; used on public profile and for matching.';
comment on column public.provider_offered_services.sort_order is 'Display order on profile (lower first).';

create index provider_offered_services_provider_id_idx on public.provider_offered_services (provider_id);
create index provider_offered_services_service_id_idx on public.provider_offered_services (service_id);

alter table public.provider_offered_services enable row level security;

-- Merged SELECT: own rows for providers; public-profile rows for anyone.
create policy "Providers or public can read offered services"
  on public.provider_offered_services for select
  using (
    (select auth.uid()) = provider_id
    or exists (
      select 1 from public.provider_profiles_public p
      where p.provider_id = provider_offered_services.provider_id
      and (p.profile_visibility = 'public' or (p.profile_visibility = 'restricted' and (select auth.role()) = 'authenticated'))
    )
  );

create policy "Providers can insert own offered services"
  on public.provider_offered_services for insert
  with check ((select auth.uid()) = provider_id);

create policy "Providers can update own offered services"
  on public.provider_offered_services for update
  using ((select auth.uid()) = provider_id)
  with check ((select auth.uid()) = provider_id);

create policy "Providers can delete own offered services"
  on public.provider_offered_services for delete
  using ((select auth.uid()) = provider_id);
