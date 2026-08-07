-- pgTAP: Task 46 — project_service_row exposes lightweight enrichment fields (no schema blob).

begin;

select plan(4);

select ok(
  (
    select pg_get_functiondef(p.oid) ~ 'enrichment_status'
      and pg_get_functiondef(p.oid) ~ 'enrichment_ready'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'project_service_row'
      and pg_get_function_identity_arguments(p.oid) in (
        'uuid, uuid',
        'p_service_request_id uuid, p_viewer_id uuid'
      )
  ),
  'project_service_row projects enrichment_status, enrichment_ready'
);

select ok(
  (
    select pg_get_functiondef(p.oid) !~ 'checklist_schema'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'project_service_row'
      and pg_get_function_identity_arguments(p.oid) in (
        'uuid, uuid',
        'p_service_request_id uuid, p_viewer_id uuid'
      )
  ),
  'project_service_row does not embed checklist_schema'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~ 'service_request_enrichments'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'project_service_row'
      and pg_get_function_identity_arguments(p.oid) in (
        'uuid, uuid',
        'p_service_request_id uuid, p_viewer_id uuid'
      )
  ),
  'project_service_row reads enrichment SoT table'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~ 'client_rating_overall_score'
      and pg_get_functiondef(p.oid) ~ 'client_rating_submitted_at'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'project_service_row'
      and pg_get_function_identity_arguments(p.oid) in (
        'uuid, uuid',
        'p_service_request_id uuid, p_viewer_id uuid'
      )
  ),
  'project_service_row projects client_rating_overall_score and client_rating_submitted_at'
);

select * from finish();
rollback;
