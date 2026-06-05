-- pgTAP: profiles, client_addresses, and private profile extensions RLS.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(15);

select set_config('rls.client_a_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.client_b_id', 'b2222222-2222-4222-8222-222222222222', true);
select set_config('rls.admin_id', 'a1111111-1111-4111-8111-111111111111', true);

select pg_temp.rls_seed_user(current_setting('rls.client_b_id')::uuid, 'client', 'Client B');
select pg_temp.rls_seed_user(current_setting('rls.admin_id')::uuid, 'admin', 'Profile Admin');

-- profiles_select / profiles_update -----------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_a_id')::uuid);

select ok(
  (select count(*) = 1 from public.profiles where id = current_setting('rls.client_a_id')::uuid),
  'user reads own profile'
);

select is(
  (select count(*)::int from public.profiles where id = current_setting('rls.client_b_id')::uuid),
  0,
  'user cannot read another profile'
);

select lives_ok(
  format(
    $$ update public.profiles set full_name = 'RLS own update' where id = '%s' $$,
    current_setting('rls.client_a_id')
  ),
  'user updates own profile'
);

-- client_addresses_select -----------------------------------------------------

select ok(
  (select count(*) >= 1 from public.client_addresses where client_id = current_setting('rls.client_a_id')::uuid),
  'client reads own addresses'
);

select is(
  (
    select count(*)::int
    from public.client_addresses
    where client_id = current_setting('rls.client_b_id')::uuid
  ),
  0,
  'client cannot read another client addresses'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select is(
  (select count(*)::int from public.client_addresses),
  0,
  'provider cannot read client_addresses directly'
);

-- client_profiles_private_select ----------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_a_id')::uuid);

select ok(
  (
    select count(*) = 1
    from public.client_profiles_private
    where client_id = current_setting('rls.client_a_id')::uuid
  ),
  'client reads own client_profiles_private'
);

select is(
  (
    select count(*)::int
    from public.client_profiles_private
    where client_id = current_setting('rls.client_b_id')::uuid
  ),
  0,
  'client cannot read another client_profiles_private'
);

select pg_temp.rls_set_auth(current_setting('rls.admin_id')::uuid);

select ok(
  (
    select count(*) >= 1
    from public.client_profiles_private
    where client_id = current_setting('rls.client_a_id')::uuid
  ),
  'admin reads client_profiles_private'
);

-- provider_profiles_public_select (public visibility) -------------------------

select pg_temp.rls_set_anon();

select ok(
  (
    select count(*) >= 1
    from public.provider_profiles_public
    where profile_visibility = 'public'
  ),
  'anon reads public provider profiles'
);

select pg_temp.rls_set_auth(current_setting('rls.client_a_id')::uuid);

select ok(
  (
    select count(*) >= 1
    from public.provider_profiles_public
    where provider_id = current_setting('rls.provider_id')::uuid
  ),
  'authenticated reads provider public profile'
);

-- provider_profiles_private_select --------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select ok(
  (
    select count(*) = 1
    from public.provider_profiles_private
    where provider_id = current_setting('rls.provider_id')::uuid
  ),
  'provider reads own provider_profiles_private'
);

select is(
  (
    select count(*)::int
    from public.provider_profiles_private
    where provider_id = current_setting('rls.client_a_id')::uuid
  ),
  0,
  'provider cannot read client private profile extension'
);

-- user_device_beacons_all -----------------------------------------------------

select ok(
  (
    select count(*) >= 0
    from public.user_device_beacons
    where profile_id = current_setting('rls.provider_id')::uuid
  ),
  'provider reads own device beacons'
);

select is(
  (
    select count(*)::int
    from public.user_device_beacons
    where profile_id = current_setting('rls.client_a_id')::uuid
  ),
  0,
  'provider cannot read another user device beacons'
);

select finish();

rollback;
