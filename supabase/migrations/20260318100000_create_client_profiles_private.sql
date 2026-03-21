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

-- Merged SELECT: own row for clients; all rows for admins.
create policy "Clients read own or admins read all client_profiles_private"
  on public.client_profiles_private for select
  using (
    (select auth.uid()) = client_id
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

create policy "Clients can update own client_profiles_private"
  on public.client_profiles_private for update
  using ((select auth.uid()) = client_id)
  with check ((select auth.uid()) = client_id);

create policy "Clients can insert own client_profiles_private"
  on public.client_profiles_private for insert
  with check (
    (select auth.uid()) = client_id
    and exists (
      select 1 from public.profiles
      where profiles.id = client_id and profiles.role = 'client'
    )
  );

-- Trigger to keep updated_at in sync (set_updated_at is created in create_forms migration).
create trigger client_profiles_private_updated_at
  before update on public.client_profiles_private
  for each row execute procedure public.set_updated_at();
