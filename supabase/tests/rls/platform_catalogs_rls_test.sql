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

-- platform_constants_all: non-admin denied ------------------------------------

select is(
  (select count(*)::int from public.platform_constants),
  0,
  'anon cannot read platform_constants (platform_constants_all)'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select is(
  (select count(*)::int from public.platform_constants),
  0,
  'client cannot read platform_constants (platform_constants_all)'
);

select pg_temp.rls_set_auth(current_setting('rls.admin_id')::uuid);

select ok(
  (select count(*) >= 1 from public.platform_constants),
  'admin reads platform_constants (platform_constants_all)'
);

-- platform_* mutations: admin only --------------------------------------------

select lives_ok(
  $$
    update public.platform_states
    set name = name
    where abbreviation = 'SC'
  $$,
  'admin can UPDATE platform_states (platform_states_update)'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

create temp table _platform_update_rows (n int);

with updated as (
  update public.platform_states
  set name = 'Hacked'
  where abbreviation = 'SC'
  returning 1
)
insert into _platform_update_rows (n)
select count(*)::int from updated;

select is(
  (select n from _platform_update_rows),
  0,
  'client cannot UPDATE platform_states (platform_states_update deny)'
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

-- platform_ai_prompt_usage_select: admin only -----------------------------------

select is(
  (select count(*)::int from public.platform_ai_prompt_usage),
  0,
  'client cannot read platform_ai_prompt_usage'
);

select pg_temp.rls_set_auth(current_setting('rls.admin_id')::uuid);

select ok(
  (select count(*) >= 0 from public.platform_ai_prompt_usage),
  'admin can read platform_ai_prompt_usage (platform_ai_prompt_usage_select)'
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
