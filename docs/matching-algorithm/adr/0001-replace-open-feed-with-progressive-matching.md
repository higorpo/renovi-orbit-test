# ADR 0001: Replace open feed with progressive matching

**Status:** Accepted (2026-06-17, updated 2026-06-17)

## Context

The platform currently exposes an open pull-based feed via `match_provider_jobs`: any provider within a configurable radius sees all `OPEN` service requests. Product requirements define a **closed progressive dispatch** with batch visibility, cumulative exposure, marketplace fallback as a last resort, and dispatch gates tied to CNS proposal/chat caps.

## Decision

The progressive matching algorithm **fully replaces** the open feed **listing**:

- Remove RPC `match_provider_jobs` and Edge Function `match-provider-jobs`.
- Introduce RPC `list_provider_opportunities` and Edge `list-provider-opportunities` (ADR 0003).
- Feed visibility = **persisted batch** (`service_request_provider_visibility`, `source = batch`) **∪ lazy fallback** when `fallback_opened_at IS NOT NULL` (#75, #85) — not status alone.
- **Detail and actions are not feed-gated:** any authenticated provider may read **`get_service`** and propose/chat on SR `OPEN` via CNS (#76–#77), subject to `DISPATCH_STOPPED` proposal cap (#88) and CNS slot rules.
- Explicit decline (`dismiss_provider_opportunity`) hides opportunity **from feed only** (#102); batch exclusion for future discovery uses **persisted batch visibility** as “already notified” (#114).
- Dispatch FSM with gates, 2-phase cron, and `next_batch_at` scheduling — see **ADR 0004**.
- Provider quality/conversion stats and ratings — see **ADR 0005**.
- UI feature `provider-jobs` and routes remain; backend and client API layers change (#118, #120).

Only service requests whose dispatch row is created after matching rollout enter the new flow (dev reset; no backfill, #8).

## Consequences

- **Positive:** Aligns product with closed dispatch, notification control, and reduced spam.
- **Positive:** Providers can still act via direct link/detail without batch visibility (#77).
- **Positive:** Lazy fallback avoids bulk visibility inserts at pool exhaustion (#75).
- **Negative:** Requires dispatch persistence tables, gate helper, cron worker, and migration away from legacy RPC.
- **Neutral:** `provider-jobs` feature name kept for UX continuity.

See also: `docs/matching-algorithm/CONTEXT.md` decisions #1, #8, #43, #49, #62, #66–#67, #75–#102, #114–#120; ADR 0003, 0004, 0005.
