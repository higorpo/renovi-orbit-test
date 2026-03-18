-- When a profile has role = 'provider', ensure corresponding rows exist in
-- provider_profiles_private and provider_profiles_public. When role = 'client',
-- ensure a row exists in client_profiles_private. Runs on INSERT and on
-- UPDATE of role.

-- Slugify display name for URL: normalize accents to ASCII, lowercase, replace non-alphanumeric with hyphen, trim.
-- Uses separate translate() calls per accent group to avoid encoding issues (e.g. "V" being dropped).
-- Portuguese/Latin: José -> jose, Simões -> simoes.
create or replace function public.slugify_for_provider(name_input text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  out_text text;
begin
  out_text := coalesce(trim(name_input), '');
  out_text := lower(out_text);
  -- Normalize accents one group at a time (same-length from/to in each translate)
  out_text := translate(out_text, 'áàâãä', 'aaaaa');
  out_text := translate(out_text, 'éèêë', 'eeee');
  out_text := translate(out_text, 'íìîï', 'iiii');
  out_text := translate(out_text, 'óòôõö', 'ooooo');
  out_text := translate(out_text, 'úùûü', 'uuuu');
  out_text := translate(out_text, 'ç', 'c');
  out_text := translate(out_text, 'ñ', 'n');
  out_text := translate(out_text, 'ý', 'y');
  out_text := regexp_replace(out_text, '[^a-z0-9\s]+', '', 'g');
  out_text := regexp_replace(out_text, '\s+', '-', 'g');
  out_text := regexp_replace(out_text, '^-+|-+$', '', 'g');
  if out_text is null or out_text = '' or out_text = 'perfil' then
    return null;
  end if;
  return out_text;
end;
$$;

comment on function public.slugify_for_provider(text) is 'Normalizes text to URL slug for provider profile (accents to ASCII); returns null if empty or "perfil".';

-- Generate a unique slug for provider_profiles_public: base from name + random 6-digit suffix (no -1, -2, -3).
-- Retries with new random if collision; fallback to uuid segment if needed.
create or replace function public.generate_unique_provider_slug(in_provider_id uuid, full_name text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  base_slug text;
  candidate text;
  attempt int := 0;
  max_attempts int := 10;
begin
  base_slug := public.slugify_for_provider(full_name);
  if base_slug is null or base_slug = '' then
    base_slug := replace(in_provider_id::text, '-', '');
  end if;

  loop
    -- Always append random 6-digit number (100000 to 999999)
    candidate := base_slug || '-' || (floor(random() * 900000) + 100000)::int::text;
    if not exists (select 1 from public.provider_profiles_public p where p.slug = candidate) then
      return candidate;
    end if;
    attempt := attempt + 1;
    if attempt >= max_attempts then
      -- Guarantee uniqueness using first 8 chars of uuid hex
      return base_slug || '-' || substr(replace(in_provider_id::text, '-', ''), 1, 8);
    end if;
  end loop;
end;
$$;

comment on function public.generate_unique_provider_slug(uuid, text) is 'Returns a unique slug for provider_profiles_public: base from full_name + random 6-digit number.';

-- Ensure role-specific tables have a row: provider -> provider_profiles_private + provider_profiles_public; client -> client_profiles_private.
create or replace function public.profiles_sync_role_tables()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  slug_value text;
begin
  if new.role = 'provider' then
    -- Insert provider_profiles_private if missing (defaults: entity_type 'pf', etc.)
    insert into public.provider_profiles_private (provider_id)
    values (new.id)
    on conflict (provider_id) do nothing;

    -- Insert provider_profiles_public if missing (slug, display_name from full_name, visibility restricted)
    if not exists (select 1 from public.provider_profiles_public p where p.provider_id = new.id) then
      slug_value := public.generate_unique_provider_slug(new.id, new.full_name);
      if slug_value is null or slug_value = '' then
        slug_value := new.id::text;
      end if;
      insert into public.provider_profiles_public (
        provider_id,
        slug,
        display_name,
        profile_visibility
      )
      values (
        new.id,
        slug_value,
        nullif(trim(new.full_name), ''),
        'restricted'
      );
    end if;
  elsif new.role = 'client' then
    -- Insert client_profiles_private if missing
    insert into public.client_profiles_private (client_id)
    values (new.id)
    on conflict (client_id) do nothing;
  end if;

  return new;
end;
$$;

comment on function public.profiles_sync_role_tables() is 'Inserts into provider_profiles_private/provider_profiles_public when role=provider, into client_profiles_private when role=client; idempotent.';

drop trigger if exists profiles_sync_provider_tables_trigger on public.profiles;
create trigger profiles_sync_role_tables_trigger
  after insert or update of role on public.profiles
  for each row
  when (new.role in ('provider', 'client'))
  execute procedure public.profiles_sync_role_tables();
