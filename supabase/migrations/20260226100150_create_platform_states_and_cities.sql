-- Platform-recognized states and cities (IBGE codes). Only admins can write; anyone can read.
-- Used to restrict address form to predefined state/city options.
-- Runs before client_addresses so client_addresses can reference platform_cities/platform_states.

create table if not exists public.platform_states (
  id uuid primary key default gen_random_uuid(),
  ibge_code integer not null,
  name text not null,
  abbreviation char(2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_states_ibge_code_key unique (ibge_code),
  constraint platform_states_abbreviation_key unique (abbreviation)
);

comment on table public.platform_states is 'States (UF) recognized by the platform; IBGE code is unique numeric identifier.';
comment on column public.platform_states.ibge_code is 'IBGE state code (numeric, unique).';
comment on column public.platform_states.abbreviation is 'UF abbreviation (e.g. SC, SP).';
comment on column public.platform_states.is_active is 'When false, hidden from non-admin users; admins see all.';

create index if not exists platform_states_ibge_code_idx on public.platform_states (ibge_code);
create index if not exists platform_states_abbreviation_idx on public.platform_states (abbreviation);

create table if not exists public.platform_cities (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references public.platform_states (id) on delete cascade,
  ibge_code integer not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_cities_state_ibge_key unique (state_id, ibge_code)
);

comment on table public.platform_cities is 'Cities (municipalities) per state recognized by the platform; IBGE code unique per state.';
comment on column public.platform_cities.state_id is 'Reference to platform_states.';
comment on column public.platform_cities.ibge_code is 'IBGE municipality code (numeric, unique within state).';
comment on column public.platform_cities.is_active is 'When false, hidden from non-admin users; admins see all.';

create index if not exists platform_cities_state_id_idx on public.platform_cities (state_id);
create index if not exists platform_cities_ibge_code_idx on public.platform_cities (state_id, ibge_code);

alter table public.platform_states enable row level security;
alter table public.platform_cities enable row level security;

-- Everyone sees only active rows; admins see all (active and inactive).
create policy "Select active platform_states or admin sees all"
  on public.platform_states for select
  using (
    is_active = true
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Select active platform_cities or admin sees all"
  on public.platform_cities for select
  using (
    is_active = true
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Only admins can insert/update/delete.
create policy "Admins can insert platform_states"
  on public.platform_states for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update platform_states"
  on public.platform_states for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can delete platform_states"
  on public.platform_states for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can insert platform_cities"
  on public.platform_cities for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update platform_cities"
  on public.platform_cities for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can delete platform_cities"
  on public.platform_cities for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create trigger platform_states_updated_at
  before update on public.platform_states
  for each row execute procedure public.set_updated_at();

create trigger platform_cities_updated_at
  before update on public.platform_cities
  for each row execute procedure public.set_updated_at();
