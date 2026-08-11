-- pgTAP fixture: view-services auth helpers (JWT-focused).
-- Included via: \ir fixtures/seed_rls_actors.inc
--
-- Unlike ../rls/fixtures/seed_rls_actors.inc, these helpers keep the session role as
-- postgres and only manipulate JWT claims. That lets DEFINER RPCs see auth.uid() while
-- temp fixture tables (_fx) remain readable. Use the shared rls/ fixture when the
-- test must evaluate RLS policies under SET ROLE authenticated/anon.
--
-- Provides:
--   pg_temp.rls_set_auth(uuid)   -> JWT sub for authenticated actor (role stays postgres).
--   pg_temp.rls_set_anon()       -> clear auth.uid() (role stays postgres).
--   pg_temp.rls_set_jwt(uuid)    -> alias of rls_set_auth.
--   pg_temp.rls_set_service_as_user(uuid) -> service_role EXECUTE + actor jwt.
--   pg_temp.rls_seed_user(uuid, role, name) -> create auth user + profile.

-- Impersonate an authenticated user via JWT only.
-- Stay as postgres so temp fixtures remain readable and DEFINER RPCs still see auth.uid().
create or replace function pg_temp.rls_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

-- Clear auth.uid() while keeping postgres role (EXECUTE on DEFINER RPCs still allowed).
create or replace function pg_temp.rls_set_anon()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
    true
  );
end;
$$;

-- Alias: JWT claims only (same as rls_set_auth in this fixture).
create or replace function pg_temp.rls_set_jwt(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform pg_temp.rls_set_auth(p_user_id);
end;
$$;

-- service_role for EXECUTE on locked-down DEFINER RPCs; jwt sub drives auth.uid().
create or replace function pg_temp.rls_set_service_as_user(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role service_role';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

-- Seed an auth user and let handle_new_user build the profile.
-- p_role: 'client' | 'provider' | 'admin'. Admin is escalated after insert
-- because the profiles_prevent_admin_role_update trigger blocks role bumps.
create or replace function pg_temp.rls_seed_user(
  p_user_id uuid,
  p_role text default 'client',
  p_name text default 'RLS test user'
)
returns void
language plpgsql
as $$
declare
  -- Admin profiles are seeded as 'client' first, then escalated below.
  v_meta_role text := case when p_role = 'admin' then 'client' else p_role end;
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_user_id::text || '@rls-test.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', p_name, 'role', v_meta_role)::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_user_id,
    json_build_object(
      'sub',
      p_user_id::text,
      'email',
      p_user_id::text || '@rls-test.local'
    )::jsonb,
    'email',
    p_user_id::text,
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do nothing;

  if p_role = 'admin' then
    alter table public.profiles disable trigger profiles_prevent_admin_role_update;
    update public.profiles
    set full_name = p_name, role = 'admin'
    where id = p_user_id;
    alter table public.profiles enable trigger profiles_prevent_admin_role_update;
  end if;
end;
$$;
