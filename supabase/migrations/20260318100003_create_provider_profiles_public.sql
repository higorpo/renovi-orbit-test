-- Provider public profile: data exposed on the public/portfolio page.
-- Visibility controlled by profile_visibility; slug used for public URL.

create table if not exists public.provider_profiles_public (
  provider_id uuid primary key references public.profiles (id) on delete cascade,
  slug text not null,
  display_name text,
  bio text,
  profile_visibility text not null default 'public' check (profile_visibility in ('public', 'restricted')),
  updated_at timestamptz not null default now(),
  constraint provider_profiles_public_slug_unique unique (slug)
);

comment on table public.provider_profiles_public is 'Provider data exposed on public profile page; visibility and slug control access.';
comment on column public.provider_profiles_public.slug is 'URL slug for /perfil/:slug; unique, lowercase, hyphenated.';
comment on column public.provider_profiles_public.display_name is 'Professional display name on profile.';
comment on column public.provider_profiles_public.bio is 'Biography / about text.';
comment on column public.provider_profiles_public.profile_visibility is 'public = anyone can view; restricted = only logged-in users.';
comment on column public.provider_profiles_public.updated_at is 'Last update of public profile.';

create index provider_profiles_public_slug_idx on public.provider_profiles_public (slug);

alter table public.provider_profiles_public enable row level security;

-- Select: public when profile_visibility = 'public'; otherwise only authenticated.
create policy "Public or authenticated can read provider_profiles_public by visibility"
  on public.provider_profiles_public for select
  using (
    profile_visibility = 'public'
    or (profile_visibility = 'restricted' and auth.role() = 'authenticated')
  );

create policy "Providers can update own provider_profiles_public"
  on public.provider_profiles_public for update
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

create policy "Providers can insert own provider_profiles_public"
  on public.provider_profiles_public for insert
  with check (
    auth.uid() = provider_id
    and exists (
      select 1 from public.profiles
      where profiles.id = provider_id and profiles.role = 'provider'
    )
  );

create trigger provider_profiles_public_updated_at
  before update on public.provider_profiles_public
  for each row execute procedure public.set_updated_at();
