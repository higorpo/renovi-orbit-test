-- pgTAP fixture: shared RLS actor + auth helpers.
-- Included via: \ir fixtures/seed_rls_actors.inc
--
-- Prerequisites: platform_* + seed users from supabase/seed.sql.
-- Provides:
--   pg_temp.rls_set_auth(uuid)   -> impersonate an authenticated user (jwt sub).
--   pg_temp.rls_set_anon()       -> impersonate the anon role (auth.uid() null).
--   pg_temp.rls_seed_user(uuid, role, name) -> create auth user + profile, with admin trick.

-- Impersonate an authenticated user: set role + jwt claims (sub = user id).
create or replace function pg_temp.rls_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

-- Impersonate the anonymous role: no sub, auth.uid() resolves to null.
create or replace function pg_temp.rls_set_anon()
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
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
