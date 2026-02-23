-- Profiles table in public schema (id, role, full_name only).
-- id = auth.users.id (one profile per authenticated user).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'provider', 'admin')),
  full_name text not null default ''
);

comment on table public.profiles is 'User profile (app data). id = auth.users.id.';
comment on column public.profiles.role is 'Role: client, provider or admin.';
comment on column public.profiles.full_name is 'Full name.';

-- RLS: user can read/update only their own profile.
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Insert: allow user to create their own profile (e.g. on first login).
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
