-- Client private data: sensitive fields (e.g. CPF) visible only to the client and admin (read-only).
-- Separated from profiles to avoid accidental exposure via SELECT * or wrong projection.

create table if not exists public.client_profiles_private (
  client_id uuid primary key references public.profiles (id) on delete cascade,
  cpf text,
  updated_at timestamptz not null default now()
);

comment on table public.client_profiles_private is 'Sensitive client data; only owner and admin (read) can access.';
comment on column public.client_profiles_private.client_id is 'References profiles.id where role = client.';
comment on column public.client_profiles_private.cpf is 'CPF for identity validation (LGPD).';
comment on column public.client_profiles_private.updated_at is 'Last update of private data.';

alter table public.client_profiles_private enable row level security;

-- Clients can read and update their own row only.
create policy "Clients can read own client_profiles_private"
  on public.client_profiles_private for select
  using (auth.uid() = client_id);

create policy "Clients can update own client_profiles_private"
  on public.client_profiles_private for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

-- Clients can insert their own row when they have a profile with role client.
create policy "Clients can insert own client_profiles_private"
  on public.client_profiles_private for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.profiles
      where profiles.id = client_id and profiles.role = 'client'
    )
  );

-- Admins can read (for support); no policy for update/delete by admin (use service role if needed).
create policy "Admins can read client_profiles_private"
  on public.client_profiles_private for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Trigger to keep updated_at in sync (set_updated_at is created in create_forms migration).
create trigger client_profiles_private_updated_at
  before update on public.client_profiles_private
  for each row execute procedure public.set_updated_at();
