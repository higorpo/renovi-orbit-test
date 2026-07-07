-- pgTAP: explicit anon EXECUTE revokes (20260706010000_revoke_anon_execute_grants_security).

begin;

select plan(34);

-- ---------------------------------------------------------------------------
-- Critical: vault signature, job_runs, device beacon purge
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege(
    'anon',
    'public.generate_provider_pricing_signature(numeric, numeric, numeric, numeric)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute generate_provider_pricing_signature'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.generate_provider_pricing_signature(numeric, numeric, numeric, numeric)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute generate_provider_pricing_signature (internal only)'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.calculate_provider_service_pricing(numeric, text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated can execute calculate_provider_service_pricing'
);

select ok(
  not has_function_privilege('anon', 'public.job_run_begin(text, text)'::regprocedure, 'EXECUTE'),
  'anon cannot execute job_run_begin'
);

select ok(
  not has_function_privilege('authenticated', 'public.job_run_begin(text, text)'::regprocedure, 'EXECUTE'),
  'authenticated cannot execute job_run_begin'
);

select ok(
  has_function_privilege('postgres', 'public.job_run_begin(text, text)'::regprocedure, 'EXECUTE'),
  'postgres can execute job_run_begin'
);

select ok(
  has_function_privilege('service_role', 'public.job_run_begin(text, text)'::regprocedure, 'EXECUTE'),
  'service_role can execute job_run_begin'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.job_run_finish(bigint, timestamp with time zone, integer, integer, integer, jsonb, text)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute job_run_finish'
);

select ok(
  not has_function_privilege('anon', 'public.job_run_abort_latest(text, text)'::regprocedure, 'EXECUTE'),
  'anon cannot execute job_run_abort_latest'
);

select ok(
  not has_function_privilege('anon', 'public.purge_stale_user_device_beacons()'::regprocedure, 'EXECUTE'),
  'anon cannot execute purge_stale_user_device_beacons'
);

select ok(
  not has_function_privilege('authenticated', 'public.purge_stale_user_device_beacons()'::regprocedure, 'EXECUTE'),
  'authenticated cannot execute purge_stale_user_device_beacons'
);

select ok(
  has_function_privilege('postgres', 'public.purge_stale_user_device_beacons()'::regprocedure, 'EXECUTE'),
  'postgres can execute purge_stale_user_device_beacons'
);

-- ---------------------------------------------------------------------------
-- Client RPCs: anon denied, authenticated allowed (sample + view-services)
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege(
    'anon',
    'public.accept_proposal(uuid, jsonb, uuid, uuid, smallint, text, jsonb, text, text, text)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute accept_proposal'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.accept_proposal(uuid, jsonb, uuid, uuid, smallint, text, jsonb, text, text, text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated can execute accept_proposal'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_provider_proposal(uuid, uuid, numeric, text, integer, text, jsonb, text[], numeric, numeric, numeric, text)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute create_provider_proposal'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.cns_send_message(public.cns_message_type, uuid, jsonb, uuid, uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute cns_send_message'
);

select ok(
  not has_function_privilege('anon', 'public.cancel_service_request(uuid, uuid)'::regprocedure, 'EXECUTE'),
  'anon cannot execute cancel_service_request'
);

select ok(
  not has_function_privilege('anon', 'public.get_service(uuid)'::regprocedure, 'EXECUTE'),
  'anon cannot execute get_service'
);

select ok(
  has_function_privilege('authenticated', 'public.get_service(uuid)'::regprocedure, 'EXECUTE'),
  'authenticated can execute get_service'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.list_services(integer, integer, text, text, text, text, text, date, date, boolean, boolean)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute list_services'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.list_services(integer, integer, text, text, text, text, text, date, date, boolean, boolean)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated can execute list_services'
);

select ok(
  not has_function_privilege('anon', 'public.project_service_row(uuid, uuid)'::regprocedure, 'EXECUTE'),
  'anon cannot execute project_service_row'
);

select ok(
  not has_function_privilege('authenticated', 'public.project_service_row(uuid, uuid)'::regprocedure, 'EXECUTE'),
  'authenticated cannot execute project_service_row (internal helper)'
);

select ok(
  not has_function_privilege('anon', 'public.service_viewer_has_access(uuid, uuid)'::regprocedure, 'EXECUTE'),
  'anon cannot execute service_viewer_has_access'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.cns_service_request_allows_chat_messaging(uuid, uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute cns_service_request_allows_chat_messaging'
);

select ok(
  has_function_privilege('anon', 'public.get_public_provider_by_slug(text)'::regprocedure, 'EXECUTE'),
  'anon can execute get_public_provider_by_slug (intentional public RPC)'
);

-- ---------------------------------------------------------------------------
-- Trigger / internal functions
-- ---------------------------------------------------------------------------

select ok(
  (
    select bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE'))
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
  'anon cannot execute trigger/internal functions'
);

select ok(
  (
    select bool_and(not has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'handle_new_user',
        'audit_chat_status_change',
        'validate_provider_proposal_pricing'
      )
  ),
  'authenticated cannot execute sample trigger/internal functions'
);

-- ---------------------------------------------------------------------------
-- Operational table grants
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.platform_rate_limits', 'SELECT')
    and not has_table_privilege('authenticated', 'public.platform_rate_limits', 'SELECT'),
  'clients cannot select platform_rate_limits'
);

select ok(
  has_table_privilege('service_role', 'public.platform_rate_limits', 'SELECT'),
  'service_role can select platform_rate_limits'
);

select ok(
  not has_table_privilege('anon', 'public.chat_rate_limit_buckets', 'SELECT')
    and not has_table_privilege('authenticated', 'public.chat_rate_limit_buckets', 'SELECT'),
  'clients cannot select chat_rate_limit_buckets'
);

select ok(
  has_table_privilege('service_role', 'public.chat_rate_limit_buckets', 'SELECT'),
  'service_role can select chat_rate_limit_buckets'
);

-- ---------------------------------------------------------------------------
-- platform_ai_prompts INSERT/UPDATE policies target authenticated only
-- ---------------------------------------------------------------------------

select ok(
  (
    select p.roles = array['authenticated']::name[]
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'platform_ai_prompts'
      and p.policyname = 'platform_ai_prompts_insert'
  ),
  'platform_ai_prompts_insert targets authenticated role only'
);

select ok(
  (
    select p.roles = array['authenticated']::name[]
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'platform_ai_prompts'
      and p.policyname = 'platform_ai_prompts_update'
  ),
  'platform_ai_prompts_update targets authenticated role only'
);

select finish();

rollback;
