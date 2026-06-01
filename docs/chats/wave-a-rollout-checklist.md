# Wave A — Rollout validation checklist (CNS task 107)

Sign-off checklist before enabling any client read paths or Wave B RPCs in production. Normative scope: design §13.10 step 1; tasks 1–22 in `docs/chats/tasks.md`.

**Environment:** staging first, then production. **Do not** ship Wave A with feature flags that expose `/chats` UI (Wave F).

---

## Pre-flight

| # | Check | Owner | Done |
|---|--------|-------|------|
| A1 | All Wave A migrations (`202606*` / `202607*` foundation through task 22) applied on staging via `yarn db:migrate` | DBA | [ ] |
| A2 | `yarn generate-supabase-types` run locally; `yarn check-supabase-types` passes in CI | Eng | [ ] |
| A3 | No pending schema diff vs `src/lib/supabase/database.types.ts` on main | Eng | [ ] |
| A4 | `platform_constants` seeds present (`chats.max_active_slots_per_service_request`, `chats.proposal_response_sla_hours`, etc.) | DBA | [ ] |
| A5 | Storage bucket `chat-media` exists with expected policies (task 15) | DBA | [ ] |

---

## Schema review (design §3)

| # | Artifact | Expected | Done |
|---|----------|----------|------|
| S1 | Enums | `cns_conversation_status`, `cns_closure_type`, `cns_inactivation_reason`, `cns_message_type`, `cns_delivery_status`, `proposal_status`, `proposal_revision_reason`, CNS `service_request_status`, `contracted_service_status` | [ ] |
| S2 | Core tables | `chats`, `chat_messages`, `chat_read_receipts`, `service_request_negotiation_stats`, `domain_events`, `rpc_idempotency_records`, `chat_audit`, `proposal_audit`, `chat_rate_limit_buckets`, `job_runs`, `services`, `chat_media_upload_sessions` | [ ] |
| S3 | RLS helpers | `is_platform_admin`, `is_chat_participant` — `SECURITY DEFINER`, granted appropriately | [ ] |
| S4 | RLS policies | Read-only participant policies on CNS tables; no authenticated direct writes to protected tables | [ ] |
| S5 | Realtime | `chats`, `chat_messages` in publication (task 18) | [ ] |
| S6 | Audit triggers | `chat_audit`, `proposal_audit` on status transitions (task 19) | [ ] |
| S7 | Legacy cleanup | 48h proposal expiry cron removed; accept guard aligned (task 20) | [ ] |
| S8 | MMD templates | CNS template keys registered (task 21) — no consumer traffic yet | [ ] |

---

## Automated validation

| # | Command | Pass criteria | Done |
|---|---------|---------------|------|
| T1 | `yarn ci` | Vitest + Deno + pgTAP + types green; CNS domains listed in summary | [ ] |
| T2 | `npx supabase test db -- supabase/tests/chats/rls_cns_test.sql` | RLS matrix smoke (if staging DB seeded) | [ ] |
| T3 | `yarn test:run src/features/chats` | Optional: ensure no FE regression before Wave F | [ ] |

---

## Client / product guardrails (R15-AC01, OAC-01)

| # | Check | Done |
|---|--------|------|
| C1 | `/chats` routes not linked from production navigation / menus | [ ] |
| C2 | No `VITE_*` flag enabling CNS UI in production env | [ ] |
| C3 | Staging may use internal QA accounts only; document cohort | [ ] |
| C4 | Mobile builds do not advertise chat until Wave F sign-off | [ ] |

---

## Backfill (if applicable)

| # | Check | Done |
|---|--------|------|
| B1 | Historical threads identified (legacy messaging, if any) | [ ] |
| B2 | Backfill script reviewed; idempotent; dry-run on staging | [ ] |
| B3 | `service_request_negotiation_stats.active_chat_count` reconciled post-backfill | [ ] |

---

## Rollback (no production CNS data yet)

If Wave A must be reverted **before** Wave B traffic:

1. **Preferred:** Restore staging DB snapshot taken immediately pre-migrate.
2. **Destructive (empty CNS tables only):** Drop Wave A objects in reverse dependency order (children first): `chat_messages`, `chat_read_receipts`, `chats`, `chat_media_upload_sessions`, `domain_events`, `rpc_idempotency_records`, audit tables, `job_runs`, `chat_rate_limit_buckets`, then enum-dependent columns/tables per migration down scripts if maintained.
3. Re-apply pre-CNS `service_requests.status` enum if task 13 was reverted manually.
4. Re-run `yarn generate-supabase-types` and confirm CI types check.

Document rollback execution date and operator in the deployment log.

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Engineering | | | |
| DBA / Platform | | | |
| Product | | | |

**Wave A approved for Wave B deploy on staging:** [ ] Yes  [ ] No

---

## References

- `docs/chats/design.md` §13.10, §3
- `docs/chats/tasks.md` tasks 1–22
- `AGENTS.md` — `yarn ci`, `yarn db:migrate`
