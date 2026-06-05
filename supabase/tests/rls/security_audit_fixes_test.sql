-- pgTAP: security audit hardening migration (20260706000000_harden_rls_security_audit_fixes).
-- Validates every fix: RLS enablement, table grants, policy shape, RPC EXECUTE grants,
-- and the behavioral consequence of provider isolation on service_requests.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(32);

-- Shared actors: seed client/provider exist (seed.sql); admin is escalated here.
select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.admin_id', 'a1111111-1111-4111-8111-111111111111', true);
select set_config('rls.service_request_id', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

select pg_temp.rls_seed_user(current_setting('rls.admin_id')::uuid, 'admin', 'Audit Admin');

-- ---------------------------------------------------------------------------
-- Fix 1: service_request_negotiation_stats — RLS on, no policies, client revoked
-- ---------------------------------------------------------------------------

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'service_request_negotiation_stats'
  ),
  'service_request_negotiation_stats has RLS enabled'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public' and tablename = 'service_request_negotiation_stats'
  ),
  0,
  'service_request_negotiation_stats has no policies (RPC/service_role only)'
);

select ok(
  not has_table_privilege('authenticated', 'public.service_request_negotiation_stats', 'SELECT')
  and not has_table_privilege('authenticated', 'public.service_request_negotiation_stats', 'INSERT')
  and not has_table_privilege('authenticated', 'public.service_request_negotiation_stats', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.service_request_negotiation_stats', 'DELETE'),
  'authenticated has no DML on service_request_negotiation_stats'
);

select ok(
  not has_table_privilege('anon', 'public.service_request_negotiation_stats', 'SELECT'),
  'anon cannot select service_request_negotiation_stats'
);

select ok(
  has_table_privilege('service_role', 'public.service_request_negotiation_stats', 'SELECT'),
  'service_role retains select on service_request_negotiation_stats'
);

-- ---------------------------------------------------------------------------
-- Fix 2: chat_media_upload_sessions — RLS on, no policies, clients revoked
-- ---------------------------------------------------------------------------

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'chat_media_upload_sessions'
  ),
  'chat_media_upload_sessions has RLS enabled'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public' and tablename = 'chat_media_upload_sessions'
  ),
  0,
  'chat_media_upload_sessions has no policies (RPC/service_role only)'
);

select ok(
  not has_table_privilege('authenticated', 'public.chat_media_upload_sessions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.chat_media_upload_sessions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.chat_media_upload_sessions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.chat_media_upload_sessions', 'DELETE'),
  'authenticated has no DML on chat_media_upload_sessions'
);

select ok(
  not has_table_privilege('anon', 'public.chat_media_upload_sessions', 'SELECT'),
  'anon cannot select chat_media_upload_sessions'
);

select ok(
  has_table_privilege('service_role', 'public.chat_media_upload_sessions', 'SELECT'),
  'service_role retains select on chat_media_upload_sessions'
);

-- ---------------------------------------------------------------------------
-- Fix 3: service_requests_select — client-own + admin only, providers denied
-- ---------------------------------------------------------------------------

select ok(
  (
    select p.roles @> array['authenticated']::name[]
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'service_requests'
      and p.policyname = 'service_requests_select'
  ),
  'service_requests_select targets the authenticated role'
);

select ok(
  (
    select p.qual ~ 'is_platform_admin'
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'service_requests'
      and p.policyname = 'service_requests_select'
  ),
  'service_requests_select grants admins via is_platform_admin()'
);

select ok(
  (
    select p.qual !~ 'provider'
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'service_requests'
      and p.policyname = 'service_requests_select'
  ),
  'service_requests_select no longer references providers (direct read denied)'
);

-- ---------------------------------------------------------------------------
-- Fix 4: platform_ai_prompts_select — admin only
-- ---------------------------------------------------------------------------

select ok(
  (
    select exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'platform_ai_prompts'
        and p.policyname = 'platform_ai_prompts_select'
        and p.cmd = 'SELECT'
        and p.roles @> array['authenticated']::name[]
        and p.qual ~ 'admin'
    )
  ),
  'platform_ai_prompts_select exists for authenticated admins'
);

-- ---------------------------------------------------------------------------
-- Fix 5: get_prompt_by_key — service_role only
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.get_prompt_by_key(text)'::regprocedure, 'EXECUTE'),
  'anon cannot execute get_prompt_by_key'
);

select ok(
  not has_function_privilege('authenticated', 'public.get_prompt_by_key(text)'::regprocedure, 'EXECUTE'),
  'authenticated cannot execute get_prompt_by_key'
);

select ok(
  has_function_privilege('service_role', 'public.get_prompt_by_key(text)'::regprocedure, 'EXECUTE'),
  'service_role can execute get_prompt_by_key'
);

-- ---------------------------------------------------------------------------
-- Fix 6: match_provider_jobs (service_role only) + get_public_provider_by_slug (anon+auth)
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege(
    'authenticated',
    'public.match_provider_jobs(uuid, double precision, double precision, integer, uuid, text, integer, integer)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute match_provider_jobs'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.match_provider_jobs(uuid, double precision, double precision, integer, uuid, text, integer, integer)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute match_provider_jobs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.match_provider_jobs(uuid, double precision, double precision, integer, uuid, text, integer, integer)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute match_provider_jobs'
);

select ok(
  has_function_privilege('anon', 'public.get_public_provider_by_slug(text)'::regprocedure, 'EXECUTE'),
  'anon can execute get_public_provider_by_slug'
);

select ok(
  has_function_privilege('authenticated', 'public.get_public_provider_by_slug(text)'::regprocedure, 'EXECUTE'),
  'authenticated can execute get_public_provider_by_slug'
);

-- ---------------------------------------------------------------------------
-- Fix 7: trigger functions lose PUBLIC execute; authenticated RPCs keep grant
-- ---------------------------------------------------------------------------

select ok(
  (
    select bool_and(p.proacl is not null and not exists (
      select 1 from aclexplode(p.proacl) a where a.grantee = 0
    ))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'handle_new_user',
        'audit_chat_status_change',
        'audit_proposal_status_change',
        'set_updated_at',
        'profiles_block_admin_role_update',
        'profiles_sync_role_tables',
        'profiles_validate_profile_image_path',
        'sync_service_request_location',
        'validate_provider_proposal_pricing',
        'reject_submitted_proposals_on_service_request_cancel'
      )
  ),
  'trigger/internal functions have PUBLIC execute revoked'
);

select ok(
  has_function_privilege('authenticated', 'public.accept_proposal(uuid, jsonb, uuid)'::regprocedure, 'EXECUTE'),
  'authenticated can execute accept_proposal'
);

select ok(
  has_function_privilege('authenticated', 'public.cancel_service_request(uuid, uuid)'::regprocedure, 'EXECUTE'),
  'authenticated can execute cancel_service_request'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.cns_send_message(public.cns_message_type, uuid, jsonb, uuid, uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated can execute cns_send_message'
);

select ok(
  has_function_privilege('authenticated', 'public.is_platform_admin()'::regprocedure, 'EXECUTE'),
  'authenticated can execute is_platform_admin'
);

-- ---------------------------------------------------------------------------
-- Behavioral: provider isolation + admin/client read on service_requests
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select is(
  (
    select count(*)::int
    from public.service_requests sr
    where sr.id = current_setting('rls.service_request_id')::uuid
  ),
  0,
  'provider cannot read a service request directly (Fix 3 isolation)'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select is(
  (
    select count(*)::int
    from public.service_requests sr
    where sr.id = current_setting('rls.service_request_id')::uuid
  ),
  1,
  'client reads own service request'
);

select pg_temp.rls_set_auth(current_setting('rls.admin_id')::uuid);

select is(
  (
    select count(*)::int
    from public.service_requests sr
    where sr.id = current_setting('rls.service_request_id')::uuid
  ),
  1,
  'admin reads any service request'
);

select ok(
  (select count(*) >= 1 from public.platform_ai_prompts),
  'admin reads platform_ai_prompts'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select is(
  (select count(*)::int from public.platform_ai_prompts),
  0,
  'non-admin (client) cannot read platform_ai_prompts'
);

select finish();

rollback;
