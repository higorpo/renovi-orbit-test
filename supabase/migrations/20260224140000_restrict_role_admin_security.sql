-- Security: ensure role 'admin' can never be set by signup or by application updates.
-- 1) Signup trigger: only allow 'client' or 'provider' from raw_user_meta_data.
-- 2) Profiles update trigger: block any update that sets role to 'admin' (admin only via DB/migration).

-- 1) Replace handle_new_user: do not accept 'admin' from metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_role text;
  meta_full_name text;
  safe_role text;
begin
  meta_role := coalesce(new.raw_user_meta_data ->> 'role', 'client');
  meta_full_name := coalesce(trim(new.raw_user_meta_data ->> 'full_name'), '');

  -- Only client and provider allowed from signup; admin must be assigned by backend/migration only
  safe_role := case
    when meta_role = 'provider' then 'provider'
    else 'client'
  end;

  insert into public.profiles (id, full_name, role)
  values (new.id, meta_full_name, safe_role);
  return new;
end;
$$;

comment on function public.handle_new_user() is 'Inserts a row into public.profiles on signup; only client or provider role from raw_user_meta_data (admin cannot be self-assigned).';

-- 2) Prevent any UPDATE on profiles from setting role to 'admin' (enforcement at DB level)
create or replace function public.profiles_block_admin_role_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only block transition TO admin; existing admins can still be updated (e.g. full_name)
  if new.role = 'admin' and (old.role is null or old.role <> 'admin') then
    raise exception 'Role admin cannot be set via application; use backend or migration only.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

comment on function public.profiles_block_admin_role_update() is 'Blocks UPDATE that sets role to admin; admin can only be set by service role or migrations.';

drop trigger if exists profiles_prevent_admin_role_update on public.profiles;
create trigger profiles_prevent_admin_role_update
  before update of role on public.profiles
  for each row
  execute procedure public.profiles_block_admin_role_update();
