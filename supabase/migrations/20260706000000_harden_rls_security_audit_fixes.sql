-- Security audit hardening (RLS gaps, RPC grants, service_requests provider isolation).
-- Fixes: negotiation_stats, upload_sessions, service_requests SELECT, AI prompts, function EXECUTE.

-- ---------------------------------------------------------------------------
-- service_request_negotiation_stats — internal CNS counter; RPC/service_role only
-- ---------------------------------------------------------------------------

alter table public.service_request_negotiation_stats enable row level security;

revoke all on table public.service_request_negotiation_stats from anon;
revoke all on table public.service_request_negotiation_stats from authenticated;
revoke all on table public.service_request_negotiation_stats from public;

grant select, insert, update, delete on table public.service_request_negotiation_stats to service_role;

comment on table public.service_request_negotiation_stats is
  'Admission counter for new ACTIVE chats per SR. Mutations only inside cns_* SECURITY DEFINER RPCs; no client API access.';

-- ---------------------------------------------------------------------------
-- chat_media_upload_sessions — RPC-mediated; deny all direct client access
-- ---------------------------------------------------------------------------

alter table public.chat_media_upload_sessions enable row level security;

revoke all on table public.chat_media_upload_sessions from anon;
revoke all on table public.chat_media_upload_sessions from public;
revoke insert, update, delete on table public.chat_media_upload_sessions from authenticated;
revoke select on table public.chat_media_upload_sessions from authenticated;

grant select, insert, update, delete on table public.chat_media_upload_sessions to service_role;

comment on table public.chat_media_upload_sessions is
  'Binds chat-media Storage uploads to cns_send_message; no direct PostgREST access (RPC + service_role only).';

-- ---------------------------------------------------------------------------
-- service_requests — providers read via masked RPCs only (list_services, get_service)
-- ---------------------------------------------------------------------------

drop policy if exists service_requests_select on public.service_requests;

create policy service_requests_select
  on public.service_requests
  for select
  to authenticated
  using (
    (select auth.uid()) = client_id
    or (select public.is_platform_admin())
  );

comment on policy service_requests_select on public.service_requests is
  'Client reads own service requests; platform admin reads all. Providers use list_services/get_service RPCs (address masked).';

-- ---------------------------------------------------------------------------
-- platform_ai_prompts — admin SELECT for Studio/app management
-- ---------------------------------------------------------------------------

create policy platform_ai_prompts_select
  on public.platform_ai_prompts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

comment on policy platform_ai_prompts_select on public.platform_ai_prompts is
  'Platform admin reads AI prompt configs; edge functions use service_role via get_prompt_by_key.';

-- ---------------------------------------------------------------------------
-- RPC EXECUTE hardening — revoke default PUBLIC grants; re-grant explicitly
-- ---------------------------------------------------------------------------

-- AI prompts: edge function only (generate-smart-description).
revoke all on function public.get_prompt_by_key(text) from public;
revoke all on function public.get_prompt_by_key(text) from anon;
revoke all on function public.get_prompt_by_key(text) from authenticated;
grant execute on function public.get_prompt_by_key(text) to service_role;

-- Provider job matching: edge function only (match-provider-jobs).
revoke all on function public.match_provider_jobs(
  uuid, double precision, double precision, integer, uuid, text, integer, integer
) from public;
revoke all on function public.match_provider_jobs(
  uuid, double precision, double precision, integer, uuid, text, integer, integer
) from anon;
revoke all on function public.match_provider_jobs(
  uuid, double precision, double precision, integer, uuid, text, integer, integer
) from authenticated;
grant execute on function public.match_provider_jobs(
  uuid, double precision, double precision, integer, uuid, text, integer, integer
) to service_role;

-- Public provider profile page (anon + authenticated).
revoke all on function public.get_public_provider_by_slug(text) from public;
grant execute on function public.get_public_provider_by_slug(text) to anon;
grant execute on function public.get_public_provider_by_slug(text) to authenticated;

-- Trigger / internal functions — not callable via PostgREST.
revoke all on function public.handle_new_user() from public;
revoke all on function public.audit_chat_status_change() from public;
revoke all on function public.audit_proposal_status_change() from public;
revoke all on function public.set_updated_at() from public;
revoke all on function public.profiles_block_admin_role_update() from public;
revoke all on function public.profiles_sync_role_tables() from public;
revoke all on function public.profiles_validate_profile_image_path() from public;
revoke all on function public.sync_service_request_location() from public;
revoke all on function public.validate_provider_proposal_pricing() from public;
revoke all on function public.reject_submitted_proposals_on_service_request_cancel() from public;

-- Authenticated client RPCs — explicit grant after PUBLIC revoke.
revoke all on function public.accept_proposal(uuid, jsonb, uuid) from public;
grant execute on function public.accept_proposal(uuid, jsonb, uuid) to authenticated;

revoke all on function public.cancel_service_request(uuid, uuid) from public;
grant execute on function public.cancel_service_request(uuid, uuid) to authenticated;

revoke all on function public.cns_close_conversation(uuid, uuid, boolean, text) from public;
grant execute on function public.cns_close_conversation(uuid, uuid, boolean, text) to authenticated;

revoke all on function public.cns_initiate_conversation(uuid, uuid) from public;
grant execute on function public.cns_initiate_conversation(uuid, uuid) to authenticated;

revoke all on function public.cns_mark_conversation_read(uuid, uuid) from public;
grant execute on function public.cns_mark_conversation_read(uuid, uuid) to authenticated;

revoke all on function public.cns_send_message(
  public.cns_message_type, uuid, jsonb, uuid, uuid
) from public;
grant execute on function public.cns_send_message(
  public.cns_message_type, uuid, jsonb, uuid, uuid
) to authenticated;

revoke all on function public.create_provider_proposal(
  uuid, uuid, numeric, text, integer, text, jsonb, text[], numeric, numeric, numeric, text
) from public;
grant execute on function public.create_provider_proposal(
  uuid, uuid, numeric, text, integer, text, jsonb, text[], numeric, numeric, numeric, text
) to authenticated;

revoke all on function public.decline_revision_request(uuid, uuid) from public;
grant execute on function public.decline_revision_request(uuid, uuid) to authenticated;

revoke all on function public.reject_proposal(uuid, uuid, text) from public;
grant execute on function public.reject_proposal(uuid, uuid, text) to authenticated;

revoke all on function public.request_proposal_revision(
  uuid, uuid, public.proposal_revision_reason, text
) from public;
grant execute on function public.request_proposal_revision(
  uuid, uuid, public.proposal_revision_reason, text
) to authenticated;

revoke all on function public.calculate_provider_service_pricing(numeric, text) from public;
grant execute on function public.calculate_provider_service_pricing(numeric, text) to authenticated;

revoke all on function public.generate_provider_pricing_signature(numeric, numeric, numeric, numeric) from public;
grant execute on function public.generate_provider_pricing_signature(numeric, numeric, numeric, numeric) to authenticated;

revoke all on function public.cns_chat_free_messaging_allowed(uuid) from public;
grant execute on function public.cns_chat_free_messaging_allowed(uuid) to authenticated;

-- Platform constant helpers are server-side only (SECURITY DEFINER RPCs / service_role).
revoke all on function public.platform_constant_int(text, integer) from public, anon, authenticated;
grant execute on function public.platform_constant_int(text, integer) to service_role;

revoke all on function public.platform_constant_bool(text, boolean) from public, anon, authenticated;
grant execute on function public.platform_constant_bool(text, boolean) to service_role;

-- RLS helper functions (authenticated only).
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

revoke all on function public.is_provider() from public;
grant execute on function public.is_provider() to authenticated;

revoke all on function public.is_chat_participant(uuid) from public;
grant execute on function public.is_chat_participant(uuid) to authenticated;
