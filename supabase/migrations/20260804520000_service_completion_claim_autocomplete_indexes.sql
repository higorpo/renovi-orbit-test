-- Service completion Task 63: verify/tune claim, reclaim, and auto-complete indexes.
-- Claim: exclude ops_attention holds from partial index (matches enrichment_claim_batch filter).
-- Auto-complete: ensure CS EXECUTED + executed_at partial index (may already exist from payments).
--
-- Claim index is created with the correct predicate in 040300; use IF NOT EXISTS here
-- (no DROP) to avoid lock drama on reset/re-apply and keep a single definition.

-- ---------------------------------------------------------------------------
-- Claim due: PENDING + claimable (ops_attention_at IS NULL)
-- ---------------------------------------------------------------------------

create index if not exists idx_enrichments_claim_due
  on public.service_request_enrichments (next_attempt_at nulls first, created_at)
  where status = 'PENDING'::public.enrichment_status
    and ops_attention_at is null;

comment on index public.idx_enrichments_claim_due is
  'Partial index for enrichment_claim_batch: due PENDING rows excluding ops_attention holds (Task 63).';

-- ---------------------------------------------------------------------------
-- Lease reclaim: confirm exists + document (created in Task 3)
-- ---------------------------------------------------------------------------

comment on index public.idx_enrichments_lease_expired is
  'Partial index for enrichment_reclaim_expired_leases: RUNNING rows by locked_until (Task 63).';

comment on index public.idx_enrichments_ready is
  'Partial index for READY-without-dispatch repair / sweeper join (Task 63).';

-- ---------------------------------------------------------------------------
-- Auto-complete: EXECUTED CS ordered by executed_at
-- ---------------------------------------------------------------------------

create index if not exists contracted_services_executed_auto_complete_idx
  on public.contracted_services (executed_at)
  where status = 'EXECUTED'::public.contracted_service_status;

comment on index public.contracted_services_executed_auto_complete_idx is
  'Partial index for service_completion_auto_complete_executed: EXECUTED rows by executed_at (Task 63 / design §3.8).';
