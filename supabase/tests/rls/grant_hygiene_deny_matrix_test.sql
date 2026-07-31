-- pgTAP: grant hygiene deny matrix (20260802320000_rls_cls_grant_hygiene_pass).
-- Extensible privilege checks for locations, rating_stats, platform_*, PII, orphan RPCs, triggers.

begin;

select plan(43);

-- ---------------------------------------------------------------------------
-- Table privileges: dead / internal aggregates
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.provider_latest_locations', 'SELECT'),
  'anon cannot SELECT provider_latest_locations'
);

select ok(
  not has_table_privilege('authenticated', 'public.provider_latest_locations', 'SELECT'),
  'authenticated cannot SELECT provider_latest_locations'
);

select ok(
  not has_table_privilege('anon', 'public.provider_rating_stats', 'SELECT'),
  'anon cannot SELECT provider_rating_stats'
);

select ok(
  not has_table_privilege('authenticated', 'public.provider_rating_stats', 'SELECT'),
  'authenticated cannot SELECT provider_rating_stats'
);

select ok(
  not has_table_privilege('authenticated', 'public.provider_rating_stats', 'INSERT'),
  'authenticated cannot INSERT provider_rating_stats'
);

select ok(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'provider_rating_stats'
      and policyname = 'provider_rating_stats_select'
  ) = 0,
  'provider_rating_stats_select policy is dropped'
);

-- ---------------------------------------------------------------------------
-- platform_* : catalog SELECT kept; secrets / usage locked; writes denied
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.platform_services', 'SELECT'),
  'authenticated retains SELECT on platform_services (catalog)'
);

select ok(
  has_table_privilege('anon', 'public.platform_services', 'SELECT'),
  'anon retains SELECT on platform_services (catalog)'
);

select ok(
  not has_table_privilege('authenticated', 'public.platform_services', 'INSERT'),
  'authenticated cannot INSERT platform_services'
);

select ok(
  not has_table_privilege('authenticated', 'public.platform_states', 'UPDATE'),
  'authenticated cannot UPDATE platform_states'
);

select ok(
  not has_table_privilege('anon', 'public.platform_constants', 'SELECT'),
  'anon cannot SELECT platform_constants'
);

select ok(
  not has_table_privilege('authenticated', 'public.platform_constants', 'SELECT'),
  'authenticated cannot SELECT platform_constants'
);

select ok(
  not has_table_privilege('anon', 'public.platform_ai_prompt_usage', 'SELECT'),
  'anon cannot SELECT platform_ai_prompt_usage'
);

select ok(
  not has_table_privilege('authenticated', 'public.platform_ai_prompt_usage', 'SELECT'),
  'authenticated cannot SELECT platform_ai_prompt_usage'
);

select ok(
  not has_table_privilege('anon', 'public.platform_ai_prompts', 'SELECT'),
  'anon cannot SELECT platform_ai_prompts'
);

select ok(
  has_table_privilege('authenticated', 'public.platform_ai_prompts', 'SELECT'),
  'authenticated retains SELECT on platform_ai_prompts (admin RLS)'
);

select ok(
  not has_table_privilege('authenticated', 'public.platform_ai_prompts', 'INSERT'),
  'authenticated cannot INSERT platform_ai_prompts'
);

-- ---------------------------------------------------------------------------
-- PII private tables + beacons: anon denied
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.client_profiles_private', 'SELECT'),
  'anon cannot SELECT client_profiles_private'
);

select ok(
  not has_table_privilege('anon', 'public.provider_profiles_private', 'SELECT'),
  'anon cannot SELECT provider_profiles_private'
);

select ok(
  has_table_privilege('authenticated', 'public.client_profiles_private', 'SELECT'),
  'authenticated retains SELECT on client_profiles_private'
);

select ok(
  not has_table_privilege('anon', 'public.user_device_beacons', 'SELECT'),
  'anon cannot SELECT user_device_beacons'
);

-- ---------------------------------------------------------------------------
-- Orphan RPCs: client EXECUTE denied; service_role kept
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege(
    'authenticated',
    'message_dispatcher.message_dispatcher_cancel(uuid, text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute message_dispatcher_cancel'
);

select ok(
  not has_function_privilege(
    'anon',
    'message_dispatcher.message_dispatcher_cancel(uuid, text)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute message_dispatcher_cancel'
);

select ok(
  has_function_privilege(
    'service_role',
    'message_dispatcher.message_dispatcher_cancel(uuid, text)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute message_dispatcher_cancel'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'message_dispatcher.message_dispatcher_audit_timeline(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute message_dispatcher_audit_timeline'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_service_rating(uuid, smallint, smallint, smallint, smallint, text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute submit_service_rating'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.submit_service_rating(uuid, smallint, smallint, smallint, smallint, text)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute submit_service_rating'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.update_service_rating(uuid, smallint, smallint, smallint, smallint, text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute update_service_rating'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_negotiation_audit_timeline(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute get_negotiation_audit_timeline'
);

-- Skipped orphans still callable by authenticated where intended
select ok(
  has_function_privilege(
    'authenticated',
    'public.list_proposal_versions(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated retains EXECUTE on list_proposal_versions (UI)'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.replay_domain_event(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated retains EXECUTE on replay_domain_event (admin-gated)'
);

-- ---------------------------------------------------------------------------
-- Trigger functions: client EXECUTE denied
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege(
    'authenticated',
    'public.trg_chat_messages_notify_fn()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute trg_chat_messages_notify_fn'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.trg_chat_messages_notify_fn()'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute trg_chat_messages_notify_fn'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.trg_chats_manual_close_notify_fn()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute trg_chats_manual_close_notify_fn'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.trg_provider_proposals_submitted_fn()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute trg_provider_proposals_submitted_fn'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.notify_proposal_status_changed()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute notify_proposal_status_changed'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.profiles_block_operational_status_update()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute profiles_block_operational_status_update'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'message_dispatcher.message_dispatcher_audit_on_dispatch_update()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute message_dispatcher_audit_on_dispatch_update'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.trg_fn_dispatch_clear_next_batch_on_terminal()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute trg_fn_dispatch_clear_next_batch_on_terminal'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.trg_service_reschedule_requests_fsm()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute trg_service_reschedule_requests_fsm'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.trg_service_reschedule_requests_terminal_immutable()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute trg_service_reschedule_requests_terminal_immutable'
);

-- ---------------------------------------------------------------------------
-- message_templates: service_role only
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('authenticated', 'message_dispatcher.message_templates', 'SELECT'),
  'authenticated cannot SELECT message_templates'
);

select ok(
  has_table_privilege('service_role', 'message_dispatcher.message_templates', 'SELECT'),
  'service_role can SELECT message_templates'
);

select * from finish();

rollback;
