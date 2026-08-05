-- Service completion Task 12: DROP OPEN-insert dispatch bootstrap (design §3.7, decision 22).
-- After this migration, OPEN insert alone MUST NOT create service_request_dispatches.
-- Bootstrap entry points: enrichment_finalize_ready / sweeper → matching_bootstrap_dispatch_for_service_request.
-- Cutover assumes DB reset — no grandfather of legacy OPEN SRs without enrichment.
-- pgTAP (OPEN insert → zero dispatch rows): Task 67.
-- Matching docs wording update: Task 75.

drop trigger if exists trg_service_request_dispatch_bootstrap
  on public.service_requests;

drop function if exists public.trg_fn_service_request_dispatch_bootstrap();
