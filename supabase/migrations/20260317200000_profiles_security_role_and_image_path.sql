-- AppSec: block client->provider self-assignment and validate profile_image_path.
-- 1) Extend role trigger: admin already blocked; also block client from setting own role to provider.
-- 2) New trigger: profile_image_path must be under users/<profile.id>/profile/ (no impersonation).

-- 1) Replace role trigger function to block client -> provider self-assignment
create or replace function public.profiles_block_admin_role_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Block transition TO admin; existing admins can still be updated (e.g. full_name)
  if new.role = 'admin' and (old.role is null or old.role <> 'admin') then
    raise exception 'Role admin cannot be set via application; use backend or migration only.'
      using errcode = 'P0001';
  end if;
  -- Block client self-assigning provider (provider only via signup or backend/migration)
  if old.role = 'client' and new.role = 'provider' then
    raise exception 'Role provider cannot be self-assigned via application.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

comment on function public.profiles_block_admin_role_update() is 'Blocks UPDATE that sets role to admin or client->provider; admin/provider only via signup or backend/migration.';

-- 2) Validate profile_image_path: must be users/<this profile id>/profile/<filename>
create or replace function public.profiles_validate_profile_image_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_image_path is null or new.profile_image_path = '' then
    return new;
  end if;
  if new.profile_image_path is not distinct from old.profile_image_path then
    return new;
  end if;
  -- Path must be: users/<profile id>/profile/<filename>
  if new.profile_image_path !~ ('^users/' || new.id::text || '/profile/.+') then
    raise exception 'profile_image_path must be under users/%/profile/', new.id
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

comment on function public.profiles_validate_profile_image_path() is 'Ensures profile_image_path references only the own user folder (no impersonation).';

drop trigger if exists profiles_validate_profile_image_path_trigger on public.profiles;
create trigger profiles_validate_profile_image_path_trigger
  before update of profile_image_path on public.profiles
  for each row
  execute procedure public.profiles_validate_profile_image_path();
