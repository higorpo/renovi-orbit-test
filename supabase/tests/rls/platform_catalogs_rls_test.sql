-- pgTAP: platform catalog tables RLS (cities, states, neighborhoods, services, forms, constants).

begin;

\ir fixtures/seed_rls_actors.inc

select plan(16);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.admin_id', 'a1111111-1111-4111-8111-111111111111', true);

select pg_temp.rls_seed_user(current_setting('rls.admin_id')::uuid, 'admin', 'Catalog Admin');

-- platform_*_select: active rows readable by anon --------------------------------

select pg_temp.rls_set_anon();

select ok(
  (select count(*) >= 1 from public.platform_states where is_active = true),
  'anon reads active platform_states (platform_states_select)'
);

select ok(
  (select count(*) >= 1 from public.platform_cities where is_active = true),
  'anon reads active platform_cities (platform_cities_select)'
);

select ok(
  (select count(*) >= 1 from public.platform_neighborhoods where is_active = true),
  'anon reads active platform_neighborhoods (platform_neighborhoods_select)'
);

select ok(
  (select count(*) >= 1 from public.platform_services where active = true),
  'anon reads active platform_services (platform_services_select)'
);

select ok(
  (select count(*) >= 1 from public.platform_forms where form_status = 'active'),
  'anon reads active platform_forms (platform_forms_select)'
);

-- platform_constants: table privileges revoked (no client SELECT) -------------

select throws_ok(
  $$select count(*)::int from public.platform_constants$$,
  '42501',
  null,
  'anon cannot read platform_constants (no table privilege)'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $$select count(*)::int from public.platform_constants$$,
  '42501',
  null,
  'client cannot read platform_constants (no table privilege)'
);

select pg_temp.rls_set_auth(current_setting('rls.admin_id')::uuid);

select throws_ok(
  $$select count(*)::int from public.platform_constants$$,
  '42501',
  null,
  'authenticated admin cannot read platform_constants (service_role/helpers only)'
);

-- platform_* mutations: client role has no INSERT/UPDATE grants -------------------

select throws_ok(
  $$
    update public.platform_states
    set name = name
    where abbreviation = 'SC'
  $$,
  '42501',
  null,
  'authenticated admin cannot UPDATE platform_states (no UPDATE privilege)'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $$
    update public.platform_states
    set name = 'Hacked'
    where abbreviation = 'SC'
  $$,
  '42501',
  null,
  'client cannot UPDATE platform_states (no UPDATE privilege)'
);

select throws_ok(
  $$
    insert into public.platform_cities (state_id, ibge_code, name, is_active)
    values (
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      9999999,
      'Forged City',
      true
    )
  $$,
  '42501',
  null,
  'client cannot INSERT platform_cities (platform_cities_insert deny)'
);

select throws_ok(
  $$
    insert into public.platform_services (title, slug, active)
    values ('Forged', 'forged-service-rls-test', true)
  $$,
  '42501',
  null,
  'client cannot INSERT platform_services (platform_services_insert deny)'
);

-- platform_ai_prompt_usage: no client table privilege ---------------------------

select throws_ok(
  $$select count(*)::int from public.platform_ai_prompt_usage$$,
  '42501',
  null,
  'client cannot read platform_ai_prompt_usage'
);

select pg_temp.rls_set_auth(current_setting('rls.admin_id')::uuid);

select throws_ok(
  $$select count(*)::int from public.platform_ai_prompt_usage$$,
  '42501',
  null,
  'authenticated admin cannot read platform_ai_prompt_usage (no table privilege)'
);

-- Structural: single SELECT policy per catalog table --------------------------

select ok(
  (
    select count(*) = 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_services'
      and cmd = 'SELECT'
  ),
  'platform_services has one SELECT policy'
);

select ok(
  (
    select count(*) = 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_constants'
      and policyname = 'platform_constants_all'
  ),
  'platform_constants uses platform_constants_all policy'
);

select finish();

rollback;
