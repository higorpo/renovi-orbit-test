-- Profiles table in public schema.
-- id = auth.users.id (one profile per authenticated user).
-- Account/contact fields and profile_image_path; use signed URLs for avatar display.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'provider', 'admin')),
  full_name text not null default '',
  phone text,
  cpf text,
  profile_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'User profile (app data). id = auth.users.id.';
comment on column public.profiles.role is 'Role: client, provider or admin.';
comment on column public.profiles.full_name is 'Full name.';
comment on column public.profiles.phone is 'Brazilian phone/WhatsApp for contact about services.';
comment on column public.profiles.cpf is 'CPF for identity validation and account protection (LGPD).';
comment on column public.profiles.profile_image_path is 'Storage path in profile-images bucket; use signed URL for display.';
comment on column public.profiles.created_at is 'When the profile was created.';
comment on column public.profiles.updated_at is 'Last profile update.';

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
