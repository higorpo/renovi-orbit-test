-- Populate public.profiles when a new user is created in auth.users.
-- Reads full_name and role from raw_user_meta_data (sent on signUp via options.data).
-- See: https://supabase.com/docs/guides/auth/managing-user-data

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

  -- Ensure role is one of the allowed values
  safe_role := case
    when meta_role in ('client', 'provider', 'admin') then meta_role
    else 'client'
  end;

  insert into public.profiles (id, full_name, role)
  values (new.id, meta_full_name, safe_role);
  return new;
end;
$$;

comment on function public.handle_new_user() is 'Inserts a row into public.profiles when a user signs up; uses full_name and role from raw_user_meta_data.';

-- Trigger: run after each insert on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
