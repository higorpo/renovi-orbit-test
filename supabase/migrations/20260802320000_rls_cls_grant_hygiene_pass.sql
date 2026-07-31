-- Grant hygiene / PII / orphan RPCs / trigger EXECUTE lockdown.
-- Least privilege for client roles (anon, authenticated); service_role / postgres retain access.

-- =============================================================================
-- 1) Dead grants — provider_latest_locations (internal matching aggregate)
-- =============================================================================

revoke all on table public.provider_latest_locations from anon, authenticated, public;

-- =============================================================================
-- 2) provider_rating_stats — drop open SELECT; no client writes / optional SELECT
-- =============================================================================

drop policy if exists provider_rating_stats_select on public.provider_rating_stats;

revoke insert, update, delete, truncate, select
  on table public.provider_rating_stats
  from anon, authenticated;

-- =============================================================================
-- 3) platform_* write grants (and SELECT lockdown for secrets / usage)
-- =============================================================================

-- Catalog tables: keep SELECT for app reads; revoke mutating privileges.
revoke insert, update, delete, truncate
  on table public.platform_states
  from anon, authenticated;

revoke insert, update, delete, truncate
  on table public.platform_cities
  from anon, authenticated;

revoke insert, update, delete, truncate
  on table public.platform_neighborhoods
  from anon, authenticated;

revoke insert, update, delete, truncate
  on table public.platform_services
  from anon, authenticated;

revoke insert, update, delete, truncate
  on table public.platform_forms
  from anon, authenticated;

-- Constants / AI usage: no client table access (helpers + Edge use service_role / postgres).
revoke all on table public.platform_constants from anon, authenticated, public;
revoke all on table public.platform_ai_prompt_usage from anon, authenticated, public;

-- AI prompts: keep SELECT for authenticated (admin-gated RLS); revoke anon + writes.
revoke all on table public.platform_ai_prompts from anon, public;
revoke insert, update, delete, truncate
  on table public.platform_ai_prompts
  from authenticated;
grant select on table public.platform_ai_prompts to authenticated;

-- =============================================================================
-- 4) PII private tables + device beacons — revoke anon (and public)
-- =============================================================================

revoke all on table public.client_profiles_private from anon, public;
revoke all on table public.provider_profiles_private from anon, public;
revoke all on table public.user_device_beacons from anon, public;

-- =============================================================================
-- 5) Orphan / unused client RPCs — revoke EXECUTE from client roles
--     SKIP: list_proposal_versions (used by negotiation-proposals UI)
--     SKIP: replay_domain_event (admin-gated; keep authenticated for future console)
-- =============================================================================

revoke all on function message_dispatcher.message_dispatcher_cancel(uuid, text)
  from public, anon, authenticated;

revoke all on function message_dispatcher.message_dispatcher_audit_timeline(uuid)
  from public, anon, authenticated;

revoke all on function public.submit_service_rating(
  uuid, smallint, smallint, smallint, smallint, text
) from public, anon, authenticated;

revoke all on function public.update_service_rating(
  uuid, smallint, smallint, smallint, smallint, text
) from public, anon, authenticated;

revoke all on function public.get_negotiation_audit_timeline(uuid)
  from public, anon, authenticated;

grant execute on function message_dispatcher.message_dispatcher_cancel(uuid, text)
  to service_role;
grant execute on function message_dispatcher.message_dispatcher_audit_timeline(uuid)
  to service_role;
grant execute on function public.submit_service_rating(
  uuid, smallint, smallint, smallint, smallint, text
) to service_role;
grant execute on function public.update_service_rating(
  uuid, smallint, smallint, smallint, smallint, text
) to service_role;
grant execute on function public.get_negotiation_audit_timeline(uuid)
  to service_role;

-- =============================================================================
-- 6) Trigger functions — revoke client EXECUTE (triggers still fire)
-- =============================================================================

revoke all on function public.trg_chat_messages_notify_fn()
  from public, anon, authenticated;
revoke all on function public.trg_chats_manual_close_notify_fn()
  from public, anon, authenticated;
revoke all on function public.trg_provider_proposals_submitted_fn()
  from public, anon, authenticated;
revoke all on function public.notify_proposal_status_changed()
  from public, anon, authenticated;
revoke all on function public.profiles_block_operational_status_update()
  from public, anon, authenticated;
revoke all on function message_dispatcher.message_dispatcher_audit_on_dispatch_update()
  from public, anon, authenticated;
revoke all on function public.trg_fn_dispatch_clear_next_batch_on_terminal()
  from public, anon, authenticated;
revoke all on function public.trg_service_reschedule_requests_chat_consistency()
  from public, anon, authenticated;
revoke all on function public.trg_service_reschedule_requests_fsm()
  from public, anon, authenticated;
revoke all on function public.trg_service_reschedule_requests_parent_consistency()
  from public, anon, authenticated;
revoke all on function public.trg_service_reschedule_requests_requester_consistency()
  from public, anon, authenticated;
revoke all on function public.trg_service_reschedule_requests_terminal_immutable()
  from public, anon, authenticated;

-- =============================================================================
-- 7) message_templates — service_role only (Edge worker); no client SELECT
-- =============================================================================

drop policy if exists message_templates_select_authenticated
  on message_dispatcher.message_templates;

revoke all on table message_dispatcher.message_templates from anon, authenticated, public;
grant select on table message_dispatcher.message_templates to service_role;
