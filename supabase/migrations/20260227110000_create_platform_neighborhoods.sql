-- Platform-recognized neighborhoods per city. Only admins can write; anyone can read.
-- Bairros are loaded by selected city in the address form.

create table if not exists public.platform_neighborhoods (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.platform_cities (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_neighborhoods_city_name_key unique (city_id, name)
);

comment on table public.platform_neighborhoods is 'Neighborhoods per city recognized by the platform; used in address form.';
comment on column public.platform_neighborhoods.city_id is 'Reference to platform_cities.';
comment on column public.platform_neighborhoods.is_active is 'When false, hidden from non-admin users; admins see all.';

create index if not exists platform_neighborhoods_city_id_idx on public.platform_neighborhoods (city_id);

alter table public.platform_neighborhoods enable row level security;

create policy "Select active platform_neighborhoods or admin sees all"
  on public.platform_neighborhoods for select
  using (
    is_active = true
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can insert platform_neighborhoods"
  on public.platform_neighborhoods for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update platform_neighborhoods"
  on public.platform_neighborhoods for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can delete platform_neighborhoods"
  on public.platform_neighborhoods for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create trigger platform_neighborhoods_updated_at
  before update on public.platform_neighborhoods
  for each row execute procedure public.set_updated_at();
