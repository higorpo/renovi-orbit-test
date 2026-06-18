# Post-rollout AC traceability audit (Task 80)

**Date:** 2026-06-17  
**Scope:** Requirements 1–13, 4A, 10A, 10B — **200 acceptance criteria**  
**Design mapping:** [design.md §12](../design.md#12-requirement-to-implementation-mapping)  
**Task coverage:** [tasks.md](../tasks.md) (Tasks 1–79 complete; Task 79 skipped)

## Sign-off checklist

- [x] **All 200 AC rows present in design §12** — Verified — 200/200 rows
- [x] **Every AC assigned to ≥1 implementation task** — Verified — 0 gaps (script audit)
- [x] **M1–M15 migrations deployed in repo** — 24 files `202607110*`–`20260711230000_*`
- [x] **Legacy `match-provider-jobs` removed (M15)** — `20260711230000_matching_drop_legacy_feed.sql`
- [x] **pgTAP matching suite** — 36 files under `supabase/tests/matching/`
- [x] **E2E matching suite** — 3 specs under `e2e/matching/`
- [x] **Client cutover (`list-provider-opportunities`)** — Tasks 60–61, 68–71
- [x] **Business docs sync** — Task 78 — `docs/business/modulos/matching-dispatch/`
- [x] **Failure injection / concurrency** — Tasks 54, 75 — no advisory lock needed (Task 79 skipped)
- [x] **Staging QA checklists** — `qa/staging-geo-batch-checklist.md`, `staging-full-batch-path-checklist.md`, `staging-mmd-new-opportunity-checklist.md`

## Requirement → deployed artifact → verification

| Req | ACs | Migration wave | Primary artifacts | Primary verification |
|-----|-----|----------------|-------------------|----------------------|
| 1 | 9 | M9–M10 | `matching_discover_candidates`, `matching_rank_candidates`, bootstrap trigger | discover_candidates_test.sql, rank_candidates_test.sql, open_batch_test.sql |
| 2 | 7 | M5–M6, M10 | `service_request_dispatches`, visibility tables, dismiss RPC | dispatch_bootstrap_trigger_test.sql, dismiss_provider_opportunity_test.sql |
| 3 | 19 | M3–M4, M9 | `provider_latest_locations`, H3+PostGIS discovery | discover_candidates_test.sql, discovery_ranking_test.sql |
| 4 | 17 | M7, M13 | rating stats triggers, `submit_service_rating` | provider_stats_triggers_test.sql, rating_rpcs_test.sql, submit_service_rating_test.sql |
| 4A | 7 | M9 | `matching_rank_candidates` score formalization | rank_candidates_test.sql, discovery_ranking_test.sql |
| 5 | 39 | M8, M10, M14 | gates, `matching_open_batch`, feed visibility | dispatch_gates_test.sql, open_batch_test.sql, cns_dispatch_integration_test.sql, e2e/dispatch-lifecycle.spec.ts |
| 6 | 8 | M11 | MMD trigger on `batch_providers` | mmd_batch_provider_notify_test.sql, mmd_new_opportunity_template_test.sql |
| 7 | 9 | M9 | `matching_rank_candidates` load balancing modifiers | rank_candidates_test.sql |
| 8 | 8 | M5, M12 | `dispatch_events`, feed audit RPCs | feed_audit_test.sql, record_provider_opportunity_view_test.sql |
| 9 | 5 | M3–M4 | GIST + H3 indexes | discover_candidates_test.sql |
| 10 | 7 | M10–M11 | cron + lease + SKIP LOCKED | cron_process_dispatches_test.sql, dispatch_lease_test.sql, concurrency_cron_test.sql |
| 10A | 10 | M10 | lease CAS, idempotent batch membership | dispatch_lease_test.sql, failure_injection_test.sql, concurrency_cron_test.sql |
| 10B | 6 | M10 | `next_batch_at`, pg_cron schedule | cron_process_dispatches_test.sql |
| 11 | 4 | M12, client | `record_provider_opportunity_view` | record_provider_opportunity_view_test.sql, e2e/provider-feed.spec.ts |
| 12 | 25 | M3–M4, client | device-beacon pipeline, `useProviderLocationTracking` | Vitest device-beacon/*, qa/staging-geo-batch-checklist.md |
| 13 | 20 | M12–M13, M15, Edge | `list_provider_opportunities`, `list-provider-opportunities` | list_provider_opportunities_*.sql, e2e/provider-feed.spec.ts, e2e/dispatch-stopped.spec.ts |

## Migration inventory (M1–M15 + follow-ups)

- `20260711000000_matching_platform_constants_seeds.sql`
- `20260711010000_matching_profiles_operational_status.sql`
- `20260711020000_matching_beacon_location_columns.sql`
- `20260711030000_matching_provider_latest_locations.sql`
- `20260711040000_matching_dispatch_enums_tables.sql`
- `20260711050000_matching_dispatch_bootstrap_trigger.sql`
- `20260711060000_matching_rating_stats_schema.sql`
- `20260711070000_matching_gate_helper.sql`
- `20260711080000_matching_discovery_ranking.sql`
- `20260711090000_matching_open_batch_and_cron.sql`
- `20260711100000_matching_mmd_batch_notification_trigger.sql`
- `20260711110000_matching_feed_audit_rpcs.sql`
- `20260711120000_matching_rating_rpcs.sql`
- `20260711130000_matching_integrate_cns_dispatch.sql`
- `20260711140000_matching_integrate_cns_dispatch_gates.sql`
- `20260711150000_matching_accept_proposal_dispatch_matched.sql`
- `20260711160000_matching_cancel_service_request_dispatch.sql`
- `20260711170000_matching_expire_pending_proposals_gate.sql`
- `20260711180000_matching_initiate_conversation_no_stopped_gate.sql`
- `20260711190000_matching_discover_distance_numeric_cast.sql`
- `20260711200000_matching_force_release_stale_leases.sql`
- `20260711210000_matching_cron_error_metadata.sql`
- `20260711220000_matching_revoke_client_execute_grants.sql`
- `20260711230000_matching_drop_legacy_feed.sql`

## pgTAP test inventory

- `accept_proposal_dispatch_matched_test.sql`
- `cancel_pending_mmd_test.sql`
- `cancel_service_request_dispatch_test.sql`
- `cns_dispatch_integration_test.sql`
- `concurrency_cron_test.sql`
- `consecutive_cron_errors_test.sql`
- `create_provider_proposal_dispatch_gate_test.sql`
- `cron_process_dispatches_test.sql`
- `discover_candidates_test.sql`
- `discovery_ranking_test.sql`
- `dismiss_provider_opportunity_test.sql`
- `dispatch_bootstrap_trigger_test.sql`
- `dispatch_gates_test.sql`
- `dispatch_lease_test.sql`
- `dispatch_visibility_unique_test.sql`
- `expire_pending_proposals_gate_test.sql`
- `failure_injection_test.sql`
- `feed_audit_test.sql`
- `force_release_stale_leases_test.sql`
- `get_service_no_dispatch_side_effects_test.sql`
- `initiate_conversation_no_stopped_gate_test.sql`
- `list_provider_opportunities_batch_test.sql`
- `list_provider_opportunities_cursor_test.sql`
- `list_provider_opportunities_fallback_test.sql`
- `mmd_batch_provider_notify_test.sql`
- `mmd_new_opportunity_template_test.sql`
- `open_batch_test.sql`
- `platform_constant_numeric_test.sql`
- `provider_stats_triggers_test.sql`
- `rank_candidates_test.sql`
- `rating_rpcs_test.sql`
- `record_provider_opportunity_view_test.sql`
- `reject_proposal_dispatch_gate_test.sql`
- `rls_matching_test.sql`
- `submit_service_rating_test.sql`
- `update_service_rating_test.sql`

## E2E test inventory

- `dispatch-lifecycle.spec.ts`
- `dispatch-stopped.spec.ts`
- `provider-feed.spec.ts`

## Gaps and non-blocking notes

| AC | Note | Disposition |
|----|------|-------------|
| 8.8 | SHOULD: future partition policy on `dispatch_events` | Deferred — operational policy, not GA blocker |
| 12.15 | SHOULD: pause tracking when `operational_status=suspended` | Partial — feed empty for suspended (#13.7); beacon pause not enforced client-side |
| 79 | Conditional advisory lock in `matching_open_batch` | Skipped — Tasks 54/75 pass without duplicate batches |

## Engineering sign-off

Matching progressive dispatch rollout is **traceable end-to-end**: design §12 maps each AC to mechanism; tasks 1–79 map each AC to deliverable code/tests; verification suites (pgTAP, Deno, Vitest, E2E) exercise primary paths. **No blocking gaps** identified for GA sign-off.

