-- Service completion Task 61: reassert GRANT/REVOKE matrix from design §11.2.2.
-- Idempotent hygiene pass — privileges fail closed for claim/finalize/auto-complete/janitor.
-- Expanded to cover enqueue, matching bootstrap, BRT helpers, validate_responses,
-- storage path helpers, resolve template, janitor helpers, path_referenced_in_frozen.

-- ---------------------------------------------------------------------------
-- Worker enrichment RPCs: service_role only (deny authenticated/anon/public)
-- ---------------------------------------------------------------------------

revoke all on function public.enrichment_claim_batch(text, int)
  from public, anon, authenticated;
grant execute on function public.enrichment_claim_batch(text, int)
  to service_role;

revoke all on function public.enrichment_finalize_ready(
  uuid, text, bigint, jsonb, public.checklist_source, uuid
) from public, anon, authenticated;
grant execute on function public.enrichment_finalize_ready(
  uuid, text, bigint, jsonb, public.checklist_source, uuid
) to service_role;

revoke all on function public.enrichment_schedule_retry(uuid, text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.enrichment_schedule_retry(uuid, text, bigint, text, text)
  to service_role;

revoke all on function public.enrichment_mark_ops_attention(
  uuid, text, text, bigint, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.enrichment_mark_ops_attention(
  uuid, text, text, bigint, uuid, jsonb
) to service_role;

-- Ops tools MAY also grant enrichment_clear_ops_attention to a restricted ops role later.
revoke all on function public.enrichment_clear_ops_attention(
  uuid, boolean, text, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.enrichment_clear_ops_attention(
  uuid, boolean, text, uuid, jsonb
) to service_role;

revoke all on function public.enrichment_reclaim_expired_leases(int)
  from public, anon, authenticated;
grant execute on function public.enrichment_reclaim_expired_leases(int)
  to service_role;
grant execute on function public.enrichment_reclaim_expired_leases(int)
  to postgres;

revoke all on function public.enrichment_repair_ready_without_dispatch(int)
  from public, anon, authenticated;
grant execute on function public.enrichment_repair_ready_without_dispatch(int)
  to service_role;
grant execute on function public.enrichment_repair_ready_without_dispatch(int)
  to postgres;

revoke all on function public.enrichment_validate_checklist_schema(jsonb)
  from public, anon, authenticated;
grant execute on function public.enrichment_validate_checklist_schema(jsonb)
  to service_role;
grant execute on function public.enrichment_validate_checklist_schema(jsonb)
  to postgres;

revoke all on function public.enrichment_append_event(
  uuid, text, text, public.enrichment_status, public.enrichment_status, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.enrichment_append_event(
  uuid, text, text, public.enrichment_status, public.enrichment_status, uuid, jsonb
) to service_role;
grant execute on function public.enrichment_append_event(
  uuid, text, text, public.enrichment_status, public.enrichment_status, uuid, jsonb
) to postgres;

revoke all on function public.enrichment_abort_for_service_request(uuid, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.enrichment_abort_for_service_request(uuid, text, uuid, jsonb)
  to service_role;
grant execute on function public.enrichment_abort_for_service_request(uuid, text, uuid, jsonb)
  to postgres;

revoke all on function public.resolve_completion_checklist_template(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_completion_checklist_template(uuid, uuid)
  to service_role;
grant execute on function public.resolve_completion_checklist_template(uuid, uuid)
  to postgres;

revoke all on function public.enrichment_cron_sweep()
  from public, anon, authenticated;
grant execute on function public.enrichment_cron_sweep()
  to postgres;

-- Enqueue: not granted to authenticated (called from create/republish DEFINER as owner).
revoke all on function public.service_request_enqueue_enrichment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.service_request_enqueue_enrichment(uuid, uuid)
  to service_role;
grant execute on function public.service_request_enqueue_enrichment(uuid, uuid)
  to postgres;

-- Matching bootstrap: worker/cron only (after OPEN trigger drop).
revoke all on function public.matching_bootstrap_dispatch_for_service_request(uuid)
  from public, anon, authenticated;
grant execute on function public.matching_bootstrap_dispatch_for_service_request(uuid)
  to service_role;
grant execute on function public.matching_bootstrap_dispatch_for_service_request(uuid)
  to postgres;

-- BRT helpers: internal; nested from mark_executed DEFINER (owner EXECUTE).
revoke all on function public.service_completion_brt_today()
  from public, anon, authenticated;
grant execute on function public.service_completion_brt_today()
  to service_role;
grant execute on function public.service_completion_brt_today()
  to postgres;

revoke all on function public.service_completion_compute_executed_late(public.contracted_services)
  from public, anon, authenticated;
grant execute on function public.service_completion_compute_executed_late(public.contracted_services)
  to service_role;
grant execute on function public.service_completion_compute_executed_late(public.contracted_services)
  to postgres;

revoke all on function public.service_completion_compute_executed_late(date, date)
  from public, anon, authenticated;
grant execute on function public.service_completion_compute_executed_late(date, date)
  to service_role;
grant execute on function public.service_completion_compute_executed_late(date, date)
  to postgres;

-- Response validation helper: not client-callable (mark_executed DEFINER nests).
revoke all on function public.service_completion_validate_evidence_responses(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.service_completion_validate_evidence_responses(jsonb, jsonb)
  to service_role;
grant execute on function public.service_completion_validate_evidence_responses(jsonb, jsonb)
  to postgres;

-- Storage path helpers: authenticated needed for storage.objects RLS policies.
revoke all on function public.service_completion_evidence_storage_path_owned(text)
  from public, anon;
grant execute on function public.service_completion_evidence_storage_path_owned(text)
  to authenticated, service_role;

revoke all on function public.service_completion_evidence_storage_upload_allowed(text)
  from public, anon;
grant execute on function public.service_completion_evidence_storage_upload_allowed(text)
  to authenticated, service_role;

-- Frozen path reference check (janitor defensive).
revoke all on function public.completion_evidence_path_referenced_in_frozen(text)
  from public, anon, authenticated;
grant execute on function public.completion_evidence_path_referenced_in_frozen(text)
  to service_role;
grant execute on function public.completion_evidence_path_referenced_in_frozen(text)
  to postgres;

-- ---------------------------------------------------------------------------
-- Completion lifecycle: authenticated clients (revoke service_role EXECUTE)
-- ---------------------------------------------------------------------------

revoke all on function public.service_completion_mark_executed(uuid, jsonb, text, int)
  from public, anon, service_role;
grant execute on function public.service_completion_mark_executed(uuid, jsonb, text, int)
  to authenticated;
grant execute on function public.service_completion_mark_executed(uuid, jsonb, text, int)
  to postgres;

revoke all on function public.service_completion_confirm_with_rating(
  uuid, smallint, smallint, smallint, smallint, text, text
) from public, anon, service_role;
grant execute on function public.service_completion_confirm_with_rating(
  uuid, smallint, smallint, smallint, smallint, text, text
) to authenticated;
grant execute on function public.service_completion_confirm_with_rating(
  uuid, smallint, smallint, smallint, smallint, text, text
) to postgres;

revoke all on function public.service_completion_save_evidence_draft(uuid, jsonb, int)
  from public, anon, service_role;
grant execute on function public.service_completion_save_evidence_draft(uuid, jsonb, int)
  to authenticated;
grant execute on function public.service_completion_save_evidence_draft(uuid, jsonb, int)
  to postgres;

revoke all on function public.service_completion_create_upload_session(uuid, text, text)
  from public, anon, service_role;
grant execute on function public.service_completion_create_upload_session(uuid, text, text)
  to authenticated;
grant execute on function public.service_completion_create_upload_session(uuid, text, text)
  to postgres;

revoke all on function public.service_completion_register_upload_object(uuid, text, text, int)
  from public, anon, service_role;
grant execute on function public.service_completion_register_upload_object(uuid, text, text, int)
  to authenticated;
grant execute on function public.service_completion_register_upload_object(uuid, text, text, int)
  to postgres;

revoke all on function public.get_service_completion_context(uuid)
  from public, anon, service_role;
grant execute on function public.get_service_completion_context(uuid)
  to authenticated;
grant execute on function public.get_service_completion_context(uuid)
  to postgres;

-- Optional rating after auto-complete (Req 16 / design §11.2.2)
grant execute on function public.submit_service_rating(
  uuid, smallint, smallint, smallint, smallint, text
) to authenticated;

grant execute on function public.update_service_rating(
  uuid, smallint, smallint, smallint, smallint, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Auto-complete / janitor / ops metrics: service_role (cron wrappers → postgres)
-- ---------------------------------------------------------------------------

revoke all on function public.service_completion_auto_complete_executed(int)
  from public, anon, authenticated;
grant execute on function public.service_completion_auto_complete_executed(int)
  to service_role;
grant execute on function public.service_completion_auto_complete_executed(int)
  to postgres;

revoke all on function public.service_completion_cron_auto_complete_executed()
  from public, anon, authenticated;
grant execute on function public.service_completion_cron_auto_complete_executed()
  to postgres;

revoke all on function public.service_completion_janitor_orphan_uploads(int)
  from public, anon, authenticated;
grant execute on function public.service_completion_janitor_orphan_uploads(int)
  to service_role;

revoke all on function public.service_completion_janitor_orphan_uploads_finalize(uuid[])
  from public, anon, authenticated;
grant execute on function public.service_completion_janitor_orphan_uploads_finalize(uuid[])
  to service_role;

revoke all on function public.service_completion_cron_orphan_upload_janitor()
  from public, anon, authenticated;
grant execute on function public.service_completion_cron_orphan_upload_janitor()
  to postgres;

revoke all on function public.service_completion_ops_metrics(int)
  from public, anon, authenticated;
grant execute on function public.service_completion_ops_metrics(int)
  to service_role;

revoke all on function public.service_completion_evaluate_sentry_alerts()
  from public, anon, authenticated;
grant execute on function public.service_completion_evaluate_sentry_alerts()
  to service_role;
grant execute on function public.service_completion_evaluate_sentry_alerts()
  to postgres;

revoke all on function public.service_completion_cron_emit_sentry_alerts()
  from public, anon, authenticated;
grant execute on function public.service_completion_cron_emit_sentry_alerts()
  to postgres;
