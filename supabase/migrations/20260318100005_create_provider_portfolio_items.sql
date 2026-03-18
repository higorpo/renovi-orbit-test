-- Portfolio items: past work items for providers (title, description, photos, etc.).

create table if not exists public.provider_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  service_id uuid references public.services (id) on delete set null,
  execution_date date,
  image_paths text[] not null default '{}',
  city_region text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.provider_portfolio_items is 'Provider portfolio / past work items; visibility controls public display.';
comment on column public.provider_portfolio_items.image_paths is 'Paths in provider-portfolio-images bucket.';
comment on column public.provider_portfolio_items.visibility is 'public = show on profile when profile visible; private = only provider sees.';
comment on column public.provider_portfolio_items.featured is 'Highlight on profile when true.';
comment on column public.provider_portfolio_items.sort_order is 'Display order (lower first).';

create index provider_portfolio_items_provider_id_idx on public.provider_portfolio_items (provider_id);
create index provider_portfolio_items_visibility_sort_idx on public.provider_portfolio_items (provider_id, visibility, sort_order);

alter table public.provider_portfolio_items enable row level security;

create policy "Providers can manage own portfolio items"
  on public.provider_portfolio_items for all
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

-- Public read: items with visibility = 'public' when provider's profile is visible.
create policy "Anyone can read public portfolio items when profile visible"
  on public.provider_portfolio_items for select
  using (
    visibility = 'public'
    and exists (
      select 1 from public.provider_profiles_public p
      where p.provider_id = provider_portfolio_items.provider_id
      and (p.profile_visibility = 'public' or (p.profile_visibility = 'restricted' and auth.role() = 'authenticated'))
    )
  );

create trigger provider_portfolio_items_updated_at
  before update on public.provider_portfolio_items
  for each row execute procedure public.set_updated_at();
