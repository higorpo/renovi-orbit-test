-- pgTAP: platform_ai_prompts RLS. Admin-only SELECT/INSERT/UPDATE; clients & anon denied.
-- Edge functions read via get_prompt_by_key (service_role only).

begin;

\ir fixtures/seed_rls_actors.inc

select plan(9);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.admin_id', 'a1111111-1111-4111-8111-111111111111', true);

select pg_temp.rls_seed_user(current_setting('rls.admin_id')::uuid, 'admin', 'AI Admin');

-- Structural ------------------------------------------------------------------

select ok(
  (
    select exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'platform_ai_prompts'
        and policyname = 'platform_ai_prompts_select'
        and cmd = 'SELECT'
        and roles @> array['authenticated']::name[]
        and qual ~ 'admin'
    )
  ),
  'platform_ai_prompts_select is admin-only for authenticated'
);

-- Behavioral ------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.admin_id')::uuid);

select ok(
  (select count(*) >= 3 from public.platform_ai_prompts),
  'admin reads platform_ai_prompts (seed prompts visible)'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select is(
  (select count(*)::int from public.platform_ai_prompts),
  0,
  'provider cannot read platform_ai_prompts'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select is(
  (select count(*)::int from public.platform_ai_prompts),
  0,
  'client cannot read platform_ai_prompts'
);

select pg_temp.rls_set_anon();

select is(
  (select count(*)::int from public.platform_ai_prompts),
  0,
  'anon cannot read platform_ai_prompts'
);

-- get_prompt_by_key is service_role only ------------------------------------

select ok(
  not has_function_privilege('authenticated', 'public.get_prompt_by_key(text)'::regprocedure, 'EXECUTE'),
  'authenticated cannot execute get_prompt_by_key'
);

select ok(
  has_function_privilege('service_role', 'public.get_prompt_by_key(text)'::regprocedure, 'EXECUTE'),
  'service_role can execute get_prompt_by_key'
);

-- Writes ----------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select throws_ok(
  $$
    insert into public.platform_ai_prompts (prompt_key, name, system_prompt)
    values ('rls_forged_prompt', 'Forged', 'forged system prompt')
  $$,
  '42501',
  null,
  'non-admin cannot insert platform_ai_prompts'
);

select pg_temp.rls_set_auth(current_setting('rls.admin_id')::uuid);

select lives_ok(
  $$
    insert into public.platform_ai_prompts (prompt_key, name, system_prompt)
    values ('rls_admin_prompt', 'Admin created', 'admin system prompt')
  $$,
  'admin can insert platform_ai_prompts'
);

select finish();

rollback;
