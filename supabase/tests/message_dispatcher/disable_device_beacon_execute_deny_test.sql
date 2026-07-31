-- pgTAP: message_dispatcher_disable_device_beacon is service_role-only (EXECUTE + body).

begin;

select plan(6);

create temp table _beacon_users as
select *
from (
  values
    ('b1111111-1111-4111-8111-111111111101'::uuid, 'device-a', 'fcm-token-a'),
    ('b2222222-2222-4222-8222-222222222202'::uuid, 'device-b', 'fcm-token-b')
) as t(profile_id, device_id, fcm_token);

-- Seed two auth users + profiles (handle_new_user) and device beacons.
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
select
  '00000000-0000-0000-0000-000000000000',
  u.profile_id,
  'authenticated',
  'authenticated',
  u.profile_id::text || '@beacon-deny-test.local',
  crypt('Abc123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  json_build_object('full_name', 'Beacon Deny ' || u.device_id, 'role', 'client')::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
from _beacon_users u
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
select
  u.profile_id,
  u.profile_id,
  json_build_object(
    'sub', u.profile_id::text,
    'email', u.profile_id::text || '@beacon-deny-test.local'
  )::jsonb,
  'email',
  u.profile_id::text,
  now(),
  now(),
  now()
from _beacon_users u
on conflict (provider_id, provider) do nothing;

insert into public.user_device_beacons (
  profile_id,
  device_id,
  fcm_token,
  push_enabled,
  platform
)
select
  u.profile_id,
  u.device_id,
  u.fcm_token,
  true,
  'android'
from _beacon_users u
on conflict (profile_id, device_id) do update
  set
    fcm_token = excluded.fcm_token,
    push_enabled = excluded.push_enabled;

-- Authenticated user A must not disable user B's beacon
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1111111-1111-4111-8111-111111111101', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', 'b1111111-1111-4111-8111-111111111101'
  )::text,
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$
    select message_dispatcher.message_dispatcher_disable_device_beacon(
      'b2222222-2222-4222-8222-222222222202'::uuid,
      'device-b'
    )
  $$,
  '42501',
  null,
  'authenticated cannot execute disable_device_beacon for another user'
);

reset role;

select is(
  (
    select b.fcm_token
    from public.user_device_beacons b
    where b.profile_id = 'b2222222-2222-4222-8222-222222222202'::uuid
      and b.device_id = 'device-b'
  ),
  'fcm-token-b',
  'user B fcm_token unchanged after authenticated deny'
);

-- service_role can disable and clears token
reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'service_role')::text,
  true
);

select lives_ok(
  $$
    select message_dispatcher.message_dispatcher_disable_device_beacon(
      'b2222222-2222-4222-8222-222222222202'::uuid,
      'device-b'
    )
  $$,
  'service_role can execute disable_device_beacon'
);

reset role;

select ok(
  (
    select b.push_enabled = false and b.fcm_token is null
    from public.user_device_beacons b
    where b.profile_id = 'b2222222-2222-4222-8222-222222222202'::uuid
      and b.device_id = 'device-b'
  ),
  'service_role clears push_enabled and fcm_token'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'message_dispatcher.message_dispatcher_disable_device_beacon(uuid,text)',
    'EXECUTE'
  ),
  'authenticated has no EXECUTE on disable_device_beacon'
);

select ok(
  not has_function_privilege(
    'anon',
    'message_dispatcher.message_dispatcher_disable_device_beacon(uuid,text)',
    'EXECUTE'
  ),
  'anon has no EXECUTE on disable_device_beacon'
);

select finish();

rollback;
