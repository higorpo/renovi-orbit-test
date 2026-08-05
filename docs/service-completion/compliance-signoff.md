# Service completion — architecture compliance sign-off (Task 80)

**Date:** 2026-08-04  
**Scope:** Tasks 1–79 + local DB after `yarn db:reset`  
**Normative:** [CONTEXT](./CONTEXT.md) · [design](./design.md) · [ADR-0001](./adr/0001-separate-enrichment-fsm-for-publication-readiness.md) · [ADR-0002](./adr/0002-evidence-images-block-not-image-gallery.md) · [ADR-0003](./adr/0003-completion-criterion-block.md) · [ADR-0004](./adr/0004-completion-rpcs-outside-payments.md) · [cutover](./cutover.md)

This review confirms runtime and docs locks before declaring the feature implementation wave **done**. Staging/prod cutover still follows [cutover.md](./cutover.md) ops sign-off.

---

## ADRs

| ADR | Lock | Evidence | Status |
|-----|------|----------|--------|
| **0001** Separate enrichment FSM | Matching bootstraps only on enrichment `READY`; not `service_request_status` / not forever-`DISPATCH_PENDING` | Tables `service_request_enrichments` + events; `enrichment_finalize_ready` → `matching_bootstrap_dispatch_for_service_request`; OPEN trigger count = **0** | ✅ |
| **0002** No `image_gallery` in completion | Evidence embedded in criterion config | `enrichment_validate_checklist_schema` reject top-level `evidence_images`; Deno/Vitest validate allowlist | ✅ |
| **0003** `completion_criterion` allowlist | Blocks: `completion_criterion` \| `static_text` only | SQL validate + Edge `validateChecklistSchema` | ✅ |
| **0004** Completion RPCs outside payments | Product writers `service_completion_*`; NetCred stays payments | `payment_mark` / `payment_confirm` count = **0**; `service_completion_mark_executed` / `confirm_with_rating` / `auto_complete_executed` present | ✅ |

---

## CONTEXT decisions 22–32

| # | Decision | Honored? | Notes |
|---|----------|----------|-------|
| 22 | DB reset cutover; no OPEN grandfather | ✅ | [cutover.md](./cutover.md); local reset applied for types |
| 23 | Operational defaults (criterion 3–12, lease 120s, etc.) | ✅ | `platform_constants` seeds + Edge pacing |
| 24 | Feature `src/features/service-completion/` | ✅ | view-services Public API only |
| 25 | Wake + cron sweeper | ✅ | `orbit_invoke_edge_function` + `enrichment_cron_sweep` |
| 26 | Enrichment 1:1 table + events | ✅ | Migrations Phase 2 |
| 27 | Claim TX → LLM out → finalize CAS | ✅ | Edge worker + RPCs |
| 28–29 | `service_completion_*` writers; drop payment completion | ✅ | ADR-0004; payment docs synced (Task 76) |
| 30 | Evidence table draft\|frozen | ✅ | `contracted_service_completion_evidence` |
| 31 | Bootstrap extract; DROP OPEN trigger | ✅ | Matching docs #135 (Task 75) |
| 32 | Gap closure: republish enqueue, context RPC, MMD auto-complete, dispute env, ops_attention, hash, rating grants | ✅ | Tasks 15, 42–46, 52, 21–22, 39, etc. |

---

## Requirements 1–25 (closure)

Implementation tasks 1–79 map to Req 1–25 via [tasks.md](./tasks.md) “Requirements covered” / design placement tables. Spot checks:

| Area | Verification artifacts |
|------|------------------------|
| Enrichment FSM / bootstrap / ops_attention | pgTAP under `supabase/tests/service_completion/` (Tasks 65–71) |
| Edge worker (checklist) | Deno suites (Task 72) — `yarn test:deno` filter `generate-completion-checklist` |
| Orphan janitor | pgTAP (Tasks 57–58) — SQL delete like KYC; no Edge |
| App hooks / UI gates | Vitest (Task 73) — 69 tests green on regen pass |
| Cutover / docs | Tasks 74–77; storage Task 79 |
| Types | Task 78 — `database.types.ts` includes `service_completion_*` / enrichment RPCs |

**Traceability:** design §12 / requirements AC ranges covered by prior task acceptance; no open `[ ]` tasks remain after this sign-off except ops execution of cutover in non-local envs.

---

## Local runtime spot-check (2026-08-04)

| Check | Result |
|-------|--------|
| `trg_service_request_dispatch_bootstrap` | absent |
| `payment_mark_service_executed` / `payment_confirm_service_completed` | absent |
| `service_completion_mark_executed` / `confirm_with_rating` / `auto_complete_executed` | present |
| Active global checklist template | 1 |
| Bucket `completion-evidence` + 3 policies | present |

---

## Residual / out of scope (not blockers)

- Full dispute FSM (stub only — decision 20 / Req 17).
- Staging/prod cutover ops sign-off rows in [cutover.md](./cutover.md) §0 (human).
- Staging upload smoke for Storage (documented in [storage-bucket.md](./storage-bucket.md)).
- CI green on full `yarn ci` matrix — run before merge to main as usual.

---

## Sign-off

| Role | Name | Date | ✅ |
|------|------|------|---|
| Implementation (agent wave Tasks 26–80) | Cursor agent | 2026-08-04 | ✅ architecture locks verified |
| Backend / migrations | | | ☐ |
| Product / matching | | | ☐ |
| Ops cutover | | | ☐ |

**Verdict:** Architecture compliance for ADRs 0001–0004 and decisions 22–32 is **met** in code + local DB + docs. Feature wave may be declared **implementation-complete**; production readiness requires human cutover §0 and CI.
