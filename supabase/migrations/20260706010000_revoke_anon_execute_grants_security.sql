-- Explicit anon/authenticated EXECUTE revokes (REVOKE FROM PUBLIC alone leaves Supabase anon grants).
-- Covers: vault pricing signature, job_runs telemetry, device beacon purge, client RPCs, internal helpers,
-- trigger functions, operational table grants, and platform_ai_prompts policy roles.

-- ---------------------------------------------------------------------------
-- Internal-only: vault HMAC — not callable via PostgREST (use calculate_provider_service_pricing).
-- ---------------------------------------------------------------------------

revoke all on function public.generate_provider_pricing_signature(numeric, numeric, numeric, numeric)
  from public, anon, authenticated;

comment on function public.generate_provider_pricing_signature(numeric, numeric, numeric, numeric) is
  'Internal HMAC for proposal pricing; invoked by calculate_provider_service_pricing and validate trigger only.';

-- ---------------------------------------------------------------------------
-- Cron / batch telemetry — postgres + service_role only (see job-runs-cron-telemetry rule).
-- ---------------------------------------------------------------------------

revoke all on function public.job_run_begin(text, text) from public, anon, authenticated;
revoke all on function public.job_run_finish(bigint, timestamptz, int, int, int, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.job_run_abort_latest(text, text) from public, anon, authenticated;

grant execute on function public.job_run_begin(text, text) to service_role, postgres;
grant execute on function public.job_run_finish(bigint, timestamptz, int, int, int, jsonb, text)
  to service_role, postgres;
grant execute on function public.job_run_abort_latest(text, text) to service_role, postgres;

revoke all on function public.purge_stale_user_device_beacons() from public, anon, authenticated, service_role;
grant execute on function public.purge_stale_user_device_beacons() to postgres;

-- ---------------------------------------------------------------------------
-- Internal helpers — only invoked from other SECURITY DEFINER RPCs (same owner).
-- ---------------------------------------------------------------------------

revoke all on function public.project_service_row(uuid, uuid) from public, anon, authenticated;
revoke all on function public.service_viewer_has_access(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger / internal functions — not callable via PostgREST.
-- ---------------------------------------------------------------------------

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.audit_chat_status_change() from public, anon, authenticated;
revoke all on function public.audit_proposal_status_change() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.profiles_block_admin_role_update() from public, anon, authenticated;
revoke all on function public.profiles_sync_role_tables() from public, anon, authenticated;
revoke all on function public.profiles_validate_profile_image_path() from public, anon, authenticated;
revoke all on function public.sync_service_request_location() from public, anon, authenticated;
revoke all on function public.validate_provider_proposal_pricing() from public, anon, authenticated;
revoke all on function public.reject_submitted_proposals_on_service_request_cancel()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Authenticated client RPCs — explicit revoke from anon after PUBLIC revoke.
-- ---------------------------------------------------------------------------

do $grant$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname = any(array[
        'accept_proposal',
        'cancel_service_request',
        'cns_close_conversation',
        'cns_initiate_conversation',
        'cns_mark_conversation_read',
        'cns_send_message',
        'create_provider_proposal',
        'decline_revision_request',
        'reject_proposal',
        'request_proposal_revision',
        'calculate_provider_service_pricing',
        'cns_chat_free_messaging_allowed',
        'platform_constant_int',
        'platform_constant_bool',
        'is_platform_admin',
        'is_provider',
        'is_chat_participant',
        'get_service',
        'list_services',
        'get_conversation_detail',
        'list_conversations',
        'list_chat_messages',
        'list_proposal_versions',
        'get_negotiation_audit_timeline',
        'get_proposal_detail_for_provider',
        'list_provider_proposal_history',
        'get_provider_proposal_job_detail',
        'list_provider_sent_budgets',
        'replay_domain_event',
        'resolve_proposal_chat_id',
        'cns_validate_upload_session',
        'cns_create_media_upload_session',
        'cns_refresh_media_signed_urls',
        'cns_service_request_allows_chat_messaging',
        'get_proposal_for_timeline',
        'list_client_received_budgets',
        'list_client_budget_questions',
        'get_client_budget_service_request_detail',
        'respond_client_budget_question',
        'reject_client_budget_proposal'
      ])
  loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end;
$grant$;

-- Public provider profile page (intentional anon + authenticated).
revoke all on function public.get_public_provider_by_slug(text) from public;
grant execute on function public.get_public_provider_by_slug(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Operational tables — service_role only (RLS deny-all is not enough alone).
-- ---------------------------------------------------------------------------

revoke all on table public.platform_rate_limits from anon, authenticated, public;
grant select, insert, update, delete on table public.platform_rate_limits to service_role;

revoke all on table public.chat_rate_limit_buckets from anon, authenticated, public;
grant select, insert, update, delete on table public.chat_rate_limit_buckets to service_role;

comment on table public.platform_rate_limits is
  'Edge-function rate limit counters; service_role only (no client PostgREST access).';

comment on table public.chat_rate_limit_buckets is
  'CNS message rate limit buckets; mutations inside cns_check_message_rate_limit (service_role / SECURITY DEFINER).';

-- ---------------------------------------------------------------------------
-- platform_ai_prompts INSERT/UPDATE — authenticated role only (admin WITH CHECK unchanged).
-- ---------------------------------------------------------------------------

drop policy if exists platform_ai_prompts_insert on public.platform_ai_prompts;
create policy platform_ai_prompts_insert
  on public.platform_ai_prompts
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

drop policy if exists platform_ai_prompts_update on public.platform_ai_prompts;
create policy platform_ai_prompts_update
  on public.platform_ai_prompts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

comment on policy platform_ai_prompts_insert on public.platform_ai_prompts is
  'Platform admin may insert AI prompt definitions (authenticated role only).';

comment on policy platform_ai_prompts_update on public.platform_ai_prompts is
  'Platform admin may update AI prompt definitions (authenticated role only).';
