-- pgTAP: service-completion Task 61 — GRANT posture matrix (design §11.2.2).
-- Asserts has_function_privilege for enrichment worker vs client completion RPCs.

begin;

select plan(28);

create or replace function pg_temp.fn_oid(p_name text)
returns regprocedure
language sql
stable
as $$
  select p.oid::regprocedure
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = p_name
  order by p.oid
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Worker enrichment: service_role yes; authenticated/anon no
-- ---------------------------------------------------------------------------

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('enrichment_claim_batch'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('enrichment_claim_batch'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('enrichment_claim_batch'), 'EXECUTE'),
  'enrichment_claim_batch: service_role only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('enrichment_finalize_ready'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('enrichment_finalize_ready'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('enrichment_finalize_ready'), 'EXECUTE'),
  'enrichment_finalize_ready: service_role only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('enrichment_schedule_retry'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('enrichment_schedule_retry'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('enrichment_schedule_retry'), 'EXECUTE'),
  'enrichment_schedule_retry: service_role only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('enrichment_mark_ops_attention'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('enrichment_mark_ops_attention'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('enrichment_mark_ops_attention'), 'EXECUTE'),
  'enrichment_mark_ops_attention: service_role only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('enrichment_clear_ops_attention'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('enrichment_clear_ops_attention'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('enrichment_clear_ops_attention'), 'EXECUTE'),
  'enrichment_clear_ops_attention: service_role only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('enrichment_reclaim_expired_leases'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('enrichment_reclaim_expired_leases'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('enrichment_reclaim_expired_leases'), 'EXECUTE'),
  'enrichment_reclaim_expired_leases: service_role only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('enrichment_repair_ready_without_dispatch'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('enrichment_repair_ready_without_dispatch'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('enrichment_repair_ready_without_dispatch'), 'EXECUTE'),
  'enrichment_repair_ready_without_dispatch: service_role only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('enrichment_validate_checklist_schema'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('enrichment_validate_checklist_schema'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('enrichment_validate_checklist_schema'), 'EXECUTE'),
  'enrichment_validate_checklist_schema: service_role only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('enrichment_append_event'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('enrichment_append_event'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('enrichment_append_event'), 'EXECUTE'),
  'enrichment_append_event: service_role only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('resolve_completion_checklist_template'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('resolve_completion_checklist_template'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('resolve_completion_checklist_template'), 'EXECUTE'),
  'resolve_completion_checklist_template: service_role only'
);

select ok(
  not has_function_privilege('authenticated', pg_temp.fn_oid('enrichment_cron_sweep'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('enrichment_cron_sweep'), 'EXECUTE')
  and has_function_privilege('postgres', pg_temp.fn_oid('enrichment_cron_sweep'), 'EXECUTE'),
  'enrichment_cron_sweep: postgres only (no authenticated/anon)'
);

-- ---------------------------------------------------------------------------
-- Client completion RPCs: authenticated yes; anon/service_role no
-- ---------------------------------------------------------------------------

select ok(
  has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_mark_executed'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_mark_executed'), 'EXECUTE')
  and not has_function_privilege('service_role', pg_temp.fn_oid('service_completion_mark_executed'), 'EXECUTE'),
  'service_completion_mark_executed: authenticated only'
);

select ok(
  has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_confirm_with_rating'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_confirm_with_rating'), 'EXECUTE')
  and not has_function_privilege('service_role', pg_temp.fn_oid('service_completion_confirm_with_rating'), 'EXECUTE'),
  'service_completion_confirm_with_rating: authenticated only'
);

select ok(
  has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_upsert_execution_declaration'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_upsert_execution_declaration'), 'EXECUTE')
  and has_function_privilege('service_role', pg_temp.fn_oid('service_completion_upsert_execution_declaration'), 'EXECUTE'),
  'service_completion_upsert_execution_declaration: authenticated + service_role'
);

select ok(
  has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_save_evidence_draft'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_save_evidence_draft'), 'EXECUTE')
  and not has_function_privilege('service_role', pg_temp.fn_oid('service_completion_save_evidence_draft'), 'EXECUTE'),
  'service_completion_save_evidence_draft: authenticated only'
);

select ok(
  has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_create_upload_session'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_create_upload_session'), 'EXECUTE')
  and not has_function_privilege('service_role', pg_temp.fn_oid('service_completion_create_upload_session'), 'EXECUTE'),
  'service_completion_create_upload_session: authenticated only'
);

select ok(
  has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_register_upload_object'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_register_upload_object'), 'EXECUTE')
  and not has_function_privilege('service_role', pg_temp.fn_oid('service_completion_register_upload_object'), 'EXECUTE'),
  'service_completion_register_upload_object: authenticated only'
);

select ok(
  has_function_privilege('authenticated', pg_temp.fn_oid('get_service_completion_context'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('get_service_completion_context'), 'EXECUTE')
  and not has_function_privilege('service_role', pg_temp.fn_oid('get_service_completion_context'), 'EXECUTE'),
  'get_service_completion_context: authenticated only'
);

select ok(
  has_function_privilege('authenticated', pg_temp.fn_oid('submit_service_rating'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('submit_service_rating'), 'EXECUTE'),
  'submit_service_rating: authenticated EXECUTE restored'
);

select ok(
  has_function_privilege('authenticated', pg_temp.fn_oid('update_service_rating'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('update_service_rating'), 'EXECUTE'),
  'update_service_rating: authenticated EXECUTE restored'
);

-- ---------------------------------------------------------------------------
-- Auto-complete / janitor / ops: service_role (or postgres for cron entrypoints)
-- ---------------------------------------------------------------------------

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('service_completion_auto_complete_executed'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_auto_complete_executed'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_auto_complete_executed'), 'EXECUTE'),
  'service_completion_auto_complete_executed: service_role only'
);

select ok(
  not has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_cron_auto_complete_executed'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_cron_auto_complete_executed'), 'EXECUTE')
  and has_function_privilege('postgres', pg_temp.fn_oid('service_completion_cron_auto_complete_executed'), 'EXECUTE'),
  'service_completion_cron_auto_complete_executed: postgres only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('service_completion_janitor_orphan_uploads'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_janitor_orphan_uploads'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_janitor_orphan_uploads'), 'EXECUTE'),
  'service_completion_janitor_orphan_uploads: service_role only'
);

select ok(
  not has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_cron_orphan_upload_janitor'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_cron_orphan_upload_janitor'), 'EXECUTE')
  and has_function_privilege('postgres', pg_temp.fn_oid('service_completion_cron_orphan_upload_janitor'), 'EXECUTE'),
  'service_completion_cron_orphan_upload_janitor: postgres only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('service_completion_ops_metrics'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_ops_metrics'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_ops_metrics'), 'EXECUTE'),
  'service_completion_ops_metrics: service_role only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('service_completion_evaluate_sentry_alerts'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_evaluate_sentry_alerts'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_evaluate_sentry_alerts'), 'EXECUTE'),
  'service_completion_evaluate_sentry_alerts: service_role only'
);

select ok(
  not has_function_privilege('authenticated', pg_temp.fn_oid('service_completion_cron_emit_sentry_alerts'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('service_completion_cron_emit_sentry_alerts'), 'EXECUTE')
  and has_function_privilege('postgres', pg_temp.fn_oid('service_completion_cron_emit_sentry_alerts'), 'EXECUTE'),
  'service_completion_cron_emit_sentry_alerts: postgres only'
);

select ok(
  has_function_privilege('service_role', pg_temp.fn_oid('enrichment_abort_for_service_request'), 'EXECUTE')
  and not has_function_privilege('authenticated', pg_temp.fn_oid('enrichment_abort_for_service_request'), 'EXECUTE')
  and not has_function_privilege('anon', pg_temp.fn_oid('enrichment_abort_for_service_request'), 'EXECUTE'),
  'enrichment_abort_for_service_request: service_role only'
);

select * from finish();

rollback;
