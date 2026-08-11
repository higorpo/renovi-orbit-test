#!/usr/bin/env python3
"""Generate docs/payment-system/tasks.md from structured task definitions."""

from __future__ import annotations

from pathlib import Path
from textwrap import dedent

from _traceability import generate_traceability

OUTPUT = Path(__file__).parent / "tasks.md"

PROJECT_STANDARDS = dedent("""
**Orbit project standards (MUST on every task):**
- Follow feature-based architecture: `src/features/payments/` with `api/`, `hooks/`, `components/`, `types/`, `index.ts` public API.
- All backend mutations via PostgreSQL RPCs (`payment_*` prefix) or the seven Edge Functions listed in `design.md` §5.3 — no business logic in components/hooks.
- Before `CREATE OR REPLACE` on extended RPCs (`accept_proposal`, `match_provider_jobs`, `cns_initiate_conversation`): run `yarn db:reset` (or apply latest migrations), dump live bodies via `pg_get_functiondef`, then apply deltas — **never** copy from design snippets alone (design.md §5.2).
- New migrations MUST use timestamp **after** the latest file in `supabase/migrations/` (currently `20260723120000_*`); increment sequentially per migration file.
- Ship RLS + explicit `REVOKE`/`GRANT EXECUTE` in the **same migration** as table/RPC creation (design.md §11.2).
- pg_cron MUST schedule `payment_cron_*()` wrappers only; each wrapper MUST record `job_runs` telemetry (`.cursor/rules/job-runs-cron-telemetry.mdc`).
- Comments in code: English only; UI strings: PT-BR.
- Run `yarn test:run`, `yarn test:deno`, and pgTAP where applicable before marking task complete.
""").strip()


def task(
    num: int,
    title: str,
    description: str,
    responsibilities: list[str],
    implementation: list[str],
    deliverables: list[str],
    dependencies: list[str],
    runtime: list[str],
    failure: list[str],
    observability: list[str],
    security: list[str],
    performance: list[str],
    requirements: list[str],
    acceptance: list[str],
) -> str:
    def bullets(items: list[str]) -> str:
        return "\n".join(f"- {i}" for i in items)

    return dedent(f"""
## {num}. [ ] {title}

Description:
{description}

{PROJECT_STANDARDS}

Responsibilities:
{bullets(responsibilities)}

Implementation Details:
{bullets(implementation)}

Deliverables:
{bullets(deliverables)}

Dependencies:
{bullets(dependencies)}

Runtime Guarantees:
{bullets(runtime)}

Failure Handling:
{bullets(failure)}

Observability:
{bullets(observability)}

Security Considerations:
{bullets(security)}

Performance Considerations:
{bullets(performance)}

Requirements covered:
{', '.join(requirements)}

Acceptance Criteria covered:
{'; '.join(acceptance) if acceptance else 'See mapped requirements above'}
""")


# Task factory helpers for brevity
def t(num, title, desc, resp, impl, deliv, deps, rt, fail, obs, sec, perf, reqs, acs=None):
    return task(num, title, desc, resp, impl, deliv, deps, rt, fail, obs, sec, perf, reqs, acs or [])


TASKS: list[str] = []

# --- Phase 1 ---
TASKS.append(t(
    1,
    "Establish payment implementation baseline and migration sequencing policy",
    "Create the engineering baseline document section in repo workflow: verify current DB state (`yarn db:reset`), list existing payment-adjacent objects (`contracted_services`, `platform_constants`, `provider_profiles_private`, `accept_proposal`), and define migration naming convention `20260801000000_payment_*` sequential blocks. This task SHALL NOT ship product code — it unblocks all subsequent migrations.",
    ["Inventory live Postgres definitions for extended RPCs", "Document rollback strategy per phase", "Align squad ownership boundaries (DB vs EF vs frontend)"],
    ["Run `SELECT pg_get_functiondef` for `accept_proposal`, `match_provider_jobs`, `cns_initiate_conversation` after latest migration", "Confirm `contracted_service_status` enum values in local DB", "Record latest migration timestamp baseline"],
    ["`docs/payment-system/IMPLEMENTATION_BASELINE.md` checklist (optional internal note in PR description)", "Verified function dumps stored in migration PR artifacts"],
    ["None — first task"],
    ["No runtime change", "Migration ordering deterministic"],
    ["N/A"],
    ["Baseline captured in PR"],
    ["No secrets in dumps"],
    ["N/A"],
    ["26", "All"],
    ["Pre-implementation gate"],
))

TASKS.append(t(
    2,
    "Migration: extend `contracted_service_status` enum and payment lifecycle columns on `contracted_services`",
    "Ship ALTER migration adding `CONFIRMED`, `EXECUTED` enum values (if not present) and columns `cancellation_reason`, `executed_at`, `completed_at`, `completed_by` per design.md §3.0. MUST NOT add `service_scheduled_at`.",
    ["Extend enum safely with `ADD VALUE IF NOT EXISTS`", "Add CHECK on `completed_by`", "Preserve existing CNS columns (`scheduled_start_date`, `scheduled_end_date`, `scheduled_shift`, `agreed_slot`)"],
    ["Single migration file after `20260723120000_*`", "Backfill NOT required — new columns nullable", "Verify no breaking change to existing CNS RPCs reading status"],
    ["Migration SQL", "pgTAP smoke: enum values exist"],
    ["Task 1"],
    ["Existing rows unchanged", "New statuses available for payment flows"],
    ["Migration reversible via forward-only enum (document limitation)"],
    ["Log migration apply in CI"],
    ["RLS on `contracted_services` unchanged unless required"],
    ["No new hot indexes on large table without need"],
    ["9", "32", "26"],
    ["9.3", "32.1", "26.1"],
))

TASKS.append(t(
    3,
    "Migration: implement `payment_service_execution_at(contracted_services)` helper function",
    "Create STABLE SQL function computing canonical service instant from `scheduled_start_date` + `scheduled_shift` in `America/Sao_Paulo` per design.md §3.0. This function SHALL be the sole scheduling anchor for T-2, T-12h, refund tiers, and manual-payment gates.",
    ["Implement shift→time mapping (morning/full_day 08:00, afternoon 13:00)", "Mark function IMMUTABLE/STABLE appropriately", "Grant EXECUTE to roles needing read helpers"],
    ["`CREATE OR REPLACE FUNCTION public.payment_service_execution_at(...)`", "Unit test via pgTAP comparing edge dates and DST boundaries", "Document anchor uses `scheduled_start_date` only"],
    ["Migration SQL", "pgTAP tests for shift combinations"],
    ["Task 2"],
    ["Deterministic output for same row snapshot", "Timezone consistent across crons"],
    ["Function replace safe"],
    ["N/A"],
    ["No PII in function"],
    ["STABLE allows planner caching per statement"],
    ["9", "14", "15", "33"],
    ["9.3", "14.1", "15.1", "33.5"],
))

TASKS.append(t(
    4,
    "Migration: seed payment keys in `platform_constants`",
    "Insert all payment-related `platform_constants` rows per design.md §3.12 / Req 25 including fee rates, retry limits, lease duration, onboarding batch size, HMAC TTL, reconciliation interval, webhook retry base, and `platform_commission_rate_pct`.",
    ["Use `INSERT ... ON CONFLICT DO UPDATE` or idempotent seed pattern", "Validate NUMERIC parsing in downstream RPCs", "Document fallback defaults when key missing (WARN log)"],
    ["Seed migration separate from table creates if `platform_constants` already exists", "Keys listed in Req 25 AC2–AC3"],
    ["Migration SQL", "Seed verification query"],
    ["Task 1"],
    ["Constants readable immediately post-migration", "Missing key fallback SHALL NOT throw"],
    ["Re-run migration idempotent"],
    ["WARN log on fallback read"],
    ["Constants readable by authenticated via existing RLS pattern"],
    ["Single-row PK lookups — no perf concern"],
    ["7", "10", "11", "14", "25"],
    ["25.1", "25.2", "25.3", "25.4"],
))

TASKS.append(t(
    5,
    "Migration: create shared payment enums and `payment_*` schema foundation",
    "Create any required ENUM types or CHECK-backed state literals documentation migration: payment schedule states, webhook states, card token states, onboarding statuses (as CHECK constraints on tables, not orphaned enums unless needed). Establish `_shared` comment block in migration header referencing design.md §3.",
    ["Align state literals with design.md §2.3 state machines", "Avoid duplicate enum types if TEXT+CHECK suffices per design"],
    ["Foundation migration precedes table CREATE migrations", "Coordinate with Supabase type generation (`yarn generate-supabase-types`)"],
    ["Migration SQL", "Updated `database.types.ts` after generate"],
    ["Task 4"],
    ["State vocabulary consistent across tables"],
    ["Forward-only"],
    ["N/A"],
    ["N/A"],
    ["N/A"],
    ["26"],
    ["26.4", "26.7"],
))

# Tables - one task each
TABLE_SPECS = [
    (6, "payment_gateway_tokens", "3.2", ["2"], ["2"], ["26.2"]),
    (7, "client_card_tokens", "3.3", ["6"], ["6", "24"], ["26.3", "24.2"]),
    (8, "provider_gateway_accounts", "3.4", ["7"], ["3", "4", "29"], ["26.8", "3.1", "29.1"]),
    (9, "payment_schedules", "3.5", ["7", "8", "3"], ["8", "9", "10", "23"], ["26.4", "9.1", "10.1"]),
    (10, "payment_attempts", "3.6", ["9"], ["10", "11", "22"], ["26.5", "10.2"]),
    (11, "payment_webhook_events", "3.7", ["9"], ["16", "17", "18", "19"], ["26.6", "16.1", "17.1"]),
    (12, "payment_webhook_processing_queue", "3.8", ["11"], ["16", "19"], ["19.1"]),
    (13, "payment_audit_log", "3.9", ["9"], ["22", "30"], ["26.7", "22.1"]),
    (14, "payment_events", "3.10", ["9"], ["30"], ["30.1"]),
]

for num, tbl, section, deps_nums, reqs, acs in TABLE_SPECS:
    dep_tasks = [f"Task {d}" for d in deps_nums]
    TASKS.append(t(
        num,
        f"Migration: CREATE `{tbl}` with constraints, indexes, and RLS policies",
        f"Implement table `{tbl}` exactly per design.md §{section} including all columns, CHECK constraints, partial indexes, UNIQUE constraints, and mandatory deny-by-default RLS in the same migration. Direct client mutations to payment state MUST be blocked.",
        [f"CREATE TABLE `{tbl}` with gateway_slug CHECK (= 'netcred') where applicable", "CREATE indexes listed in design", "ENABLE RLS; policies per §11.2 matrix", "REVOKE direct INSERT/UPDATE from authenticated where mutations are RPC-only"],
        ["Timestamp after prior payment migration", "pgTAP: RLS enabled, policy count > 0", "Run `yarn generate-supabase-types`", "Verify no PUBLIC grants on table"],
        [f"Migration `*_create_{tbl}.sql`", "RLS policies", "pgTAP RLS tests", "Indexes"],
        dep_tasks,
        ["Append-only tables reject UPDATE/DELETE via grants", "FK integrity enforced"],
        ["Migration failure rolls back entire file"],
        ["Audit table creation in migration log"],
        ["Least-privilege RLS", "service_role only where required"],
        ["Partial indexes for cron/eligibility queries"],
        reqs,
        acs,
    ))

TASKS.append(t(
    15,
    "Migration: extend `provider_profiles_private` with KYC/banking/document columns",
    "ALTER existing `provider_profiles_private` adding payment KYC columns per design.md §3.11. MUST NOT create `provider_kyc_submissions` table. Phone for KYC reuses `profiles.phone`.",
    ["Add legal_rep phone, bank fields, document URLs", "Preserve existing RLS pattern", "Private storage bucket paths documented"],
    ["Same migration or follow-on to provider_gateway_accounts", "Align with `payment_submit_provider_kyc` upcoming RPC"],
    ["ALTER migration", "Storage policy alignment note"],
    ["Task 8"],
    ["1 row per provider overwrite semantics"],
    ["Column add non-breaking"],
    ["N/A"],
    ["Provider-only SELECT/UPDATE own row"],
    ["N/A"],
    ["3", "26"],
    ["3.2", "3.3", "26.8"],
))

TASKS.append(t(
    16,
    "Migration: create payment history views `client_payment_transactions_v` and `provider_payment_receivables_v`",
    "Implement read models per design.md §3.13 with `security_invoker = true`, column visibility rules (client sees paid_amount/base_amount; provider sees provider_payout net), and supporting indexes.",
    ["Views MUST NOT expose cross-role financial fields", "Filter to realized money movement (PAID+ states)", "RLS on underlying tables applies via invoker"],
    ["CREATE VIEW with documented column semantics", "GRANT SELECT to authenticated", "pgTAP visibility tests per role"],
    ["Two view migrations or single file", "Index migrations §3.13"],
    ["Tasks 9", "13"],
    ["Read-only; no mutation path"],
    ["View replace idempotent"],
    ["Role-scoped columns"],
    ["Index-backed joins to payment_schedules"],
    ["26", "27"],
    ["26.9", "1.7.11"],
))

# Phase 3 - Core RPCs - batch of critical ones individually
CORE_RPCS = [
    (17, "payment_calculate_charge_amount", "Pure fee computation RPC mirroring installment formula; ROUND_HALF_UP; reads platform_constants; used at claim and charge time.", ["7", "25"], ["9", "10"], ["7.6", "25.5"]),
    (18, "payment_calculate_installment_options", "Client RPC: fee table 1-12, HMAC via Vault INSTALLMENT_SIGNING_SECRET, expires_at TTL from platform_constants.", ["17", "4"], ["7", "8", "27"], ["7.1", "7.4", "7.5", "8.1"]),
    (19, "payment_get_checkout_step_requirements", "Returns needs_cpf, needs_phone, needs_card for stepper.", ["7"], ["5"], ["5.1"]),
    (20, "payment_persist_client_card_token", "service_role RPC called by tokenize EF; INSERT client_card_tokens ACTIVE only.", ["7"], ["6"], ["6.3"]),
    (21, "payment_submit_provider_kyc", "Atomic KYC persist: provider_profiles_private, provider_gateway_accounts DOCUMENTS_SUBMITTED, audit KYC_SUBMITTED, MMD enqueue.", ["8", "15"], ["3"], ["3.4", "3.5"]),
    (22, "payment_revoke_client_card_token", "Client RPC: REVOKED state; block if linked SCHEDULED/FAILED without replacement.", ["7", "9"], ["28"], ["28.3", "28.4"]),
    (23, "payment_update_method", "FOR UPDATE schedule; HMAC revalidation on brand change; audit PAYMENT_METHOD_UPDATED.", ["9", "18"], ["8"], ["8.7", "8.8"]),
    (24, "payment_reschedule_charge_date", "service_role: recompute charge_scheduled_at on service reschedule; reset upcoming_charge_notified_at; audit CHARGE_RESCHEDULED.", ["3", "9"], ["9"], ["9.3", "9.4"]),
]

for num, name, desc, reqs, dep_tasks, acs in CORE_RPCS:
    TASKS.append(t(
        num, f"Implement RPC `{name}`",
        f"{desc} SECURITY DEFINER with explicit REVOKE/GRANT EXECUTE per design.md §5.2. SET search_path includes vault/extensions when secrets needed.",
        [f"Implement `{name}` body per design.md §4–5", "Authorize caller (auth.uid() or service_role)", "Insert audit/events in same TX when mutating"],
        ["Dump no extended RPC unless this replaces greenfield function", "pgTAP tests for auth failures and happy path", "Errcodes mapped to API error_code"],
        [f"Migration SQL", f"RPC `{name}`", "pgTAP", "Types regenerate"],
        [f"Task {d}" for d in dep_tasks],
        ["Atomic TX for mutations", "Idempotency where specified"],
        ["RAISE mapped errors; no partial commits"],
        ["Structured RAISE LOG for ops"],
        ["SECURITY DEFINER + in-function auth"],
        ["FOR UPDATE / index-friendly WHERE clauses"],
        reqs, acs,
    ))

TASKS.append(t(
    25,
    "Extend RPC `accept_proposal` with payment schedule creation (dump-first migration)",
    "Evolve existing CNS `accept_proposal` to validate pricing_signature + installment_selection_hmac (Vault), verify provider ACTIVE + token ACTIVE, create contracted_services PENDING_PAYMENT + payment_schedules SCHEDULED in single TX, compute charge_scheduled_at via payment_service_execution_at, idempotency via UNIQUE idempotency_key / rpc_idempotency_records.",
    ["MANDATORY: dump live accept_proposal from local DB before editing", "Include clearsale_session_id, client_ip_address, frozen commission/payout", "Insert payment_audit_log CHARGE_SCHEDULED + payment_events ChargeScheduled"],
    ["pg_get_functiondef baseline in PR", "pgTAP: idempotent retry returns same service id", "pgTAP: invalid HMAC rejects", "pgTAP: PROVIDER_NOT_CREDENTIALED"],
    ["Migration SQL", "Extended accept_proposal", "pgTAP suite", "Feature api wrapper in payments/api"],
    ["Tasks 3", "9", "18", "8"],
    ["Single TX acceptance + schedule", "Idempotent on duplicate key"],
    ["Conflict → return existing contracted_service_id HTTP 200 semantics via RPC"],
    ["Audit row same TX"],
    ["auth.uid() client scope; provider credential check"],
    ["Minimal locking: validate token FOR UPDATE"],
    ["8", "9", "29", "31"],
    ["8.1–8.6", "9.1", "29.3", "31.6"],
))

TASKS.append(t(
    26,
    "Extend RPC `match_provider_jobs` with onboarding gate (dump-first migration)",
    "Add guard: if provider_gateway_accounts.onboarding_status != ACTIVE (including SUSPENDED), return empty feed. Enforcement MUST be in SECURITY DEFINER RPC, not UI-only.",
    ["Dump live function first per §5.2", "SUSPENDED treated same as non-ACTIVE for feed", "Existing matching logic preserved"],
    ["pgTAP: non-ACTIVE provider gets zero rows", "pgTAP: ACTIVE provider unchanged behavior"],
    ["Migration SQL", "pgTAP"],
    ["Task 8"],
    ["Empty result set — no error leak"],
    ["N/A"],
    ["N/A"],
    ["No extra join without index — use provider_id"],
    ["3", "29"],
    ["3.5", "29.1", "29.5"],
))

TASKS.append(t(
    27,
    "Extend RPC `cns_initiate_conversation` with credentialing gate (dump-first migration)",
    "Deny chat initiation unless provider onboarding_status = ACTIVE; raise PROVIDER_NOT_CREDENTIALED; no thread created.",
    ["Dump live function first", "SUSPENDED denial with same error family"],
    ["pgTAP denial cases", "E2E chat gate test later"],
    ["Migration SQL", "pgTAP"],
    ["Task 8", "Task 26"],
    ["Fail-closed on non-ACTIVE"],
    ["N/A"],
    ["N/A"],
    ["N/A"],
    ["3", "29"],
    ["3.6", "29.2", "29.5"],
))

# Charge orchestration RPCs
CHARGE_RPCS = [
    (28, "payment_claim_charge_batch", "SKIP LOCKED lease; increment automatic_attempt_count atomically; return charge_amount via payment_calculate_charge_amount; eligibility filters per Req 10.", ["10", "11", "23"], ["9", "17"], ["10.1", "10.2", "23.1"]),
    (29, "payment_commit_charge_outcome", "Classify outcomes PAID/IN_ANALYSIS/FAILED/FAILED_PERMANENT; update contracted_services on PAID; insert payment_attempts + audit + payment_events; terminal errors skip attempt increment rules per matrix.", ["10", "11", "12", "22", "30"], ["28", "10"], ["10.3–10.7", "11.3"]),
    (30, "payment_begin_manual_attempt", "Manual lease + T-12h gate + clearsale_session_id/client_ip update; manual_attempt_count++; concurrency 409 PAYMENT_ALREADY_IN_PROGRESS.", ["11", "13", "23", "31"], ["9", "28"], ["13.3", "23.4", "31.8"]),
    (31, "payment_enqueue_notifications", "Post-commit MMD ingest for payment notification matrix §1.7.9; decoupled from state TX.", ["12", "33"], ["29"], ["12.1", "12.3"]),
    (32, "payment_recover_orphaned_schedules", "Janitor: PROCESSING + expired locked_until → SCHEDULED or FAILED; audit ORPHAN_RECOVERED.", ["11", "23"], ["9"], ["23.2"]),
]

for num, name, desc, reqs, deps, acs in CHARGE_RPCS:
    TASKS.append(t(
        num, f"Implement RPC `{name}`",
        desc + " service_role-only unless noted. Follow error classification matrix design.md §4.6.",
        [f"Transactional semantics per design §7", "Explicit GRANT to service_role / postgres as applicable"],
        ["pgTAP concurrency tests for claim/begin", "pgTAP outcome transitions"],
        [f"Migration", f"RPC `{name}`", "pgTAP"],
        [f"Task {d}" for d in deps],
        ["Lease + state atomicity", "Notifications after commit (enqueue RPC)"],
        ["Per-row exception isolation in batch callers"],
        ["job_runs at wrapper layer not here"],
        ["service_role only"],
        ["SKIP LOCKED batch limits"],
        reqs, acs,
    ))

# Webhook RPCs
WEBHOOK_RPCS = [
    (33, "payment_ingest_webhook_event", "INSERT RECEIVED before HMAC; raw payload immutable.", ["16"], ["11"], ["16.1"]),
    (34, "payment_enqueue_webhook_processing", "Queue PENDING; parent VALIDATING; UNIQUE webhook_event_id.", ["16", "19"], ["11", "12"], ["16.5"]),
    (35, "payment_process_webhook_event", "Full dispatch table §4.7.3; regression guard; idempotent duplicates.", ["17", "18", "19"], ["11", "9"], ["17.2", "18.1"]),
    (36, "payment_claim_webhook_processing_batch", "SKIP LOCKED on queue PENDING.", ["19"], ["12"], ["19.1"]),
    (37, "payment_claim_webhook_retry_batch", "SKIP LOCKED on events FAILED.", ["19"], ["11"], ["19.2"]),
    (38, "payment_begin_refund_request", "computeRefundAmount in SQL; REFUND_REQUESTED + cancel service TX.", ["15"], ["9"], ["15.1–15.3"]),
    (39, "payment_claim_stale_schedules_for_reconciliation", "Stale IN_ANALYSIS/PROCESSING/REFUND_REQUESTED > 30min.", ["20"], ["9"], ["20.1"]),
    (40, "payment_process_reconciliation_outcome", "Commit getTransaction results.", ["20"], ["29"], ["20.2"]),
]

for num, name, desc, reqs, deps, acs in WEBHOOK_RPCS:
    TASKS.append(t(
        num, f"Implement RPC `{name}`",
        desc,
        ["Implement per design §4.7–4.9", "Audit + events in same TX as state change"],
        ["pgTAP handler matrix spot checks", "Dead letter escalation paths"],
        ["Migration", "RPC", "pgTAP"],
        [f"Task {d}" for d in deps],
        ["Webhook idempotency UNIQUE constraint", "Regression-safe transitions"],
        ["Retry backoff on FAILED", "DEAD_LETTER after 3 attempts"],
        ["Sentry hooks in EF layer for CRITICAL"],
        ["service_role / webhook EF only"],
        ["Batch claim limits"],
        reqs, acs,
    ))

# Onboarding RPCs
ONBOARD_RPCS = [
    (41, "payment_list_gateway_accounts_for_onboarding", "Batch select DOCUMENTS_SUBMITTED/UNDER_NETCRED_REVIEW limit platform_constants batch size.", ["4"], ["8"], ["4.1"]),
    (42, "payment_activate_provider_from_netcred", "TX: ACTIVE + netcred ids + audit + MMD push.", ["4"], ["8"], ["4.2"]),
    (43, "payment_update_provider_onboarding_status", "Intermediate states; no netcred ids on UNDER_NETCRED_REVIEW.", ["4"], ["8"], ["4.4", "4.5"]),
]

for num, name, desc, reqs, deps, acs in ONBOARD_RPCS:
    TASKS.append(t(
        num, f"Implement RPC `{name}`",
        desc,
        ["Validate single edge / bankAccounts non-empty before ACTIVE in caller EF", "Atomic commit in RPC"],
        ["pgTAP activation invariants"],
        ["Migration", "RPC"],
        [f"Task {d}" for d in deps],
        ["No partial ACTIVE without bank account ids"],
        ["Skip duplicate edges — manual review"],
        ["WARNING logs"],
        ["service_role"],
        ["Partial index on onboarding_status"],
        reqs, acs,
    ))

# Batch/cron target RPCs
BATCH_RPCS = [
    (44, "payment_auto_cancel_services", "T-12h batch with IN_ANALYSIS path; PROVIDER_SUSPENDED reason; per-row EXCEPTION.", ["14"], ["3", "9"], ["14.1–14.7"]),
    (45, "payment_notify_upcoming_charges_batch", "Claim 24h pre-charge; set upcoming_charge_notified_at atomically.", ["33"], ["9"], ["33.1–33.3"]),
    (46, "payment_claim_upcoming_charge_notifications", "SKIP LOCKED helper used by notify batch.", ["33"], ["9"], ["33.1"]),
    (47, "payment_auto_complete_executed_services", "EXECUTED + 24h → COMPLETED system.", ["32"], ["2"], ["32.3"]),
    (48, "payment_mark_service_executed", "Provider RPC: CONFIRMED→EXECUTED date gate.", ["32"], ["2", "9"], ["32.1", "32.6"]),
    (49, "payment_reset_dead_letter_event", "Operator recovery tool.", ["19"], ["11"], ["19.4"]),
    (50, "payment_reconstruct_audit_lifecycle", "Operator audit timeline RPC.", ["22"], ["13"], ["22.4"]),
]

for num, name, desc, reqs, deps, acs in BATCH_RPCS:
    TASKS.append(t(
        num, f"Implement RPC `{name}`",
        desc,
        ["p_record_job_run := false when called from cron wrapper", "MMD enqueue after commit where required"],
        ["pgTAP batch idempotency", "pgTAP auto-cancel IN_ANALYSIS rules"],
        ["Migration", "RPC", "pgTAP"],
        [f"Task {d}" for d in deps],
        ["Idempotent auto-cancel on already CANCELLED", "Notification dedupe via upcoming_charge_notified_at"],
        ["Per-row EXCEPTION continues batch"],
        ["job_runs at wrapper"],
        ["Role-appropriate GRANT"],
        ["FOR UPDATE SKIP LOCKED"],
        reqs, acs,
    ))

# Cron wrappers
CRON_WRAPPERS = [
    (51, "payment_cron_schedule_netcred_charges", "payment_cron_invoke_edge_function('schedule-netcred-charges')", "0 9,15,21,3 * * *", ["28"]),
    (52, "payment_cron_auto_cancel_unpaid_services", "payment_auto_cancel_services()", "15 9,15,21,3 * * *", ["44"]),
    (53, "payment_cron_notify_upcoming_charges", "payment_notify_upcoming_charges_batch()", "30 9,15,21,3 * * *", ["45"]),
    (54, "payment_cron_auto_complete_executed_services", "payment_auto_complete_executed_services()", "45 9,15,21,3 * * *", ["47"]),
    (55, "payment_cron_process_webhook_retry", "claim queue + claim failed events + process", "*/5 * * * *", ["36", "37", "35"]),
    (56, "payment_cron_recover_orphaned_schedules", "payment_recover_orphaned_schedules()", "*/30 * * * *", ["32"]),
    (57, "payment_cron_detect_netcred_onboarding", "invoke detect-netcred-onboarding EF", "0 10 * * *", ["41"]),
    (58, "payment_cron_reconcile_netcred_payments", "invoke reconcile-netcred-payments EF", "*/30 * * * *", ["39"]),
    (59, "payment_cron_invoke_edge_function", "Internal pg_net helper with job_runs metadata.", "N/A", []),
]

for num, name, body, schedule, deps in CRON_WRAPPERS:
    TASKS.append(t(
        num, f"Implement pg_cron wrapper `{name}` with job_runs telemetry",
        f"SECURITY DEFINER wrapper: job_run_begin → delegate {body} → job_run_finish; GRANT EXECUTE TO postgres ONLY; register pg_cron schedule `{schedule}` (disabled until rollout phase).",
        ["v_job_name matches cron.job.jobname", "EXCEPTION → job_run_abort_latest", "Pass p_record_job_run := false to inner batch RPCs"],
        ["Follow example design.md §6.4", "Anti-patterns forbidden table compliance"],
        ["Migration", f"Wrapper `{name}`", "pg_cron schedule SQL (commented until rollout)"],
        [f"Task {d}" for d in deps] if deps else ["Task 59 for EF invoke wrappers"],
        ["Exactly one job_runs row per pg_cron fire"],
        ["Wrapper crash → abort_latest"],
        ["job_name LIKE 'payment_%' filterable"],
        ["postgres role only"],
        ["N/A"],
        ["10", "14", "19", "20", "33"],
        ["6.4 telemetry ACs"],
    ))

# Edge Functions + shared adapter
EF_TASKS = [
    (60, "Scaffold `src/features/payments` and `_shared/payment` module layout", "Create feature public API, types, constants.ts Option A gateway config, folder structure per design §13.", ["1"], [], ["1.1"]),
    (61, "Implement `PaymentProvider` interface and `NetCredAdapter` core", "tokenizeCard, createCharge, getTransaction, refund, void, refreshAuthToken with ProviderAuthError single retry.", ["1", "2"], ["60"], ["1.1–1.6"]),
    (62, "Implement NetCred JWT cache with SELECT FOR UPDATE in adapter", "payment_gateway_tokens read/refresh; 60min threshold; sandbox assertion CRITICAL.", ["2"], ["6", "61"], ["2.1–2.5"]),
    (63, "Implement `buildPayoutRule` split helper (ADR-0001)", "FIXED provider + PERCENTAGE prestway remainder.", ["10"], ["61"], ["10.2", "1.7.4"]),
    (64, "Edge Function `tokenize-payment-card`", "PCI path → paymentProfileCreate → payment_persist_client_card_token RPC.", ["6", "24"], ["20", "61"], ["6.1–6.4"]),
    (65, "Edge Function `schedule-netcred-charges`", "claim → loop chargeCreate → commit → enqueue notifications; timeout getTransaction first.", ["10", "11", "23"], ["28", "29", "31", "61", "63"], ["10.1–10.8"]),
    (66, "Edge Function `manual-charge-payment`", "begin_manual_attempt → chargeCreate → commit; fresh ClearSale session.", ["13", "31"], ["30", "61"], ["13.2–13.5"]),
    (67, "Edge Function `netcred-webhook`", "Raw ingest RPC → HMAC timingSafeEqual → inline or enqueue.", ["16", "17"], ["33", "34", "35"], ["16.1–16.5"]),
    (68, "Edge Function `process-refund`", "begin_refund_request → transactionRefund.", ["15"], ["38", "61"], ["15.1", "15.9"]),
    (69, "Edge Function `detect-netcred-onboarding`", "Batch GraphQL 50 aliases; activation RPCs.", ["4"], ["41", "42", "43", "61"], ["4.1–4.7"]),
    (70, "Edge Function `reconcile-netcred-payments`", "claim stale → getTransaction → commit.", ["20"], ["39", "40", "61"], ["20.1–20.4"]),
]

for item in EF_TASKS:
    num, title, desc, reqs, deps, acs = item
    TASKS.append(t(
        num, title, desc,
        ["Deno tests in supabase/functions", "Sentry transaction per invocation", "No business state in EF memory"],
        ["Register in supabase/config.toml", "Vault secrets via env", "Invoke RPCs only for DB mutations"],
        ["EF source", "Deno unit tests", "_shared modules"],
        [f"Task {d}" for d in deps],
        ["Stateless EF", "Idempotent adapter operations"],
        ["Independent per-schedule error boundaries in charge EF"],
        ["Sentry spans gateway_latency_ms"],
        ["PCI: no card logging", "Webhook rate limits"],
        ["Batch size limits", "Inter-batch 2s delay onboarding"],
        reqs, acs,
    ))

# Frontend tasks
FE_TASKS = [
    (71, "Checkout stepper: step resolution RPC integration", "payment_get_checkout_step_requirements; ordered steps CPF→phone→card→installments→confirm.", ["5"], ["19"], ["5.1–5.3"]),
    (72, "Checkout stepper: CPF and phone collection steps", "Client/server validation; persist via RPC/edge as designed.", ["5"], ["71"], ["5.2", "5.3"]),
    (73, "Checkout stepper: ClearSale fp.js integration", "UUID stable per session; async loader; Capacitor WebView.", ["31"], ["71"], ["31.1–31.4"]),
    (74, "Checkout stepper: card form and saved card selection", "Reuse components; tokenize EF invoke; billing address required.", ["5", "6", "28"], ["64", "71"], ["5.4–5.7", "6.1"]),
    (75, "Checkout stepper: installment selection UI", "payment_calculate_installment_options RPC; disclosure totals Req 27.", ["7", "27"], ["18", "74"], ["7.1", "27.3"]),
    (76, "Checkout stepper: confirmation disclosures and accept_proposal submit", "Charge timing disclosure; ToS block; PAYMENT_TERMS_ACCEPTED audit via server.", ["8", "27", "31"], ["25", "75"], ["8.1", "27.1", "27.4", "31.6"]),
    (77, "Provider KYC onboarding blocking UI", "Blocking screen; payment_submit_provider_kyc.", ["3"], ["21"], ["3.1", "3.2"]),
    (78, "Saved cards profile management UI", "List/revoke/add via shared card component.", ["28"], ["22", "64"], ["28.1–28.4"]),
    (79, "Manual payment recovery UI (`Efetuar Pagamento`)", "Gate on FAILED/FAILED_PERMANENT; ClearSale refresh; manual-charge EF.", ["13", "31"], ["66", "30"], ["13.1–13.5"]),
    (80, "Service completion UI (provider execute + client confirm)", "payment_mark_service_executed RPC hooks.", ["32"], ["48"], ["32.1–32.2"]),
    (81, "Payment history views consumption in client/provider apps", "Query views with role-appropriate columns.", ["26"], ["16"], ["1.7.11"]),
]

for num, title, desc, reqs, deps, acs in FE_TASKS:
    TASKS.append(t(
        num, title, desc,
        ["Hooks call api/ only", "Mobile-first UX per platform-ux rule"],
        ["Feature index.ts exports", "Vitest component/hook tests"],
        ["React components", "hooks", "api modules"],
        [f"Task {d}" for d in deps],
        ["No supabase client in components"],
        ["User-visible error codes mapped"],
        ["Analytics events if applicable"],
        ["No PCI data in state/cache"],
        ["Lazy load ClearSale script"],
        reqs, acs,
    ))

# Observability, recovery, security, perf, verification, rollout
LATE_TASKS = [
    (82, "Sentry instrumentation matrix for payment EFs and CRITICAL alerts", "Implement §10.1 severity matrix: AUTH_FAILURE, DEAD_LETTER, FAILED_PERMANENT WARNING, auto-cancel WARNING.", ["21"], ["60", "64", "65", "66", "67", "68", "69", "70"], ["21.1–21.7"]),
    (83, "Structured logging conventions for payment RPCs", "RAISE LOG json context; correlation via schedule_id/service_id.", ["22"], ["13"], ["22.1"]),
    (84, "payment_audit_log INSERT triggers enforcement", "Deny UPDATE/DELETE; optional trigger prevent mutation.", ["22"], ["13"], ["22.5"]),
    (85, "payment_events emission on all domain transitions", "ChargeScheduled, ChargeSucceeded, etc. per Req 30 catalog.", ["30"], ["29", "35"], ["30.1"]),
    (86, "Integrate rescheduling subsystem with payment_reschedule_charge_date", "Hook CNS reschedule confirm to RPC; post-PAID rules.", ["9"], ["24"], ["9.3", "9.4"]),
    (87, "Integrate service cancellation flows with payment cancel/refund paths", "Pre-PAID cancel RPC; post-PAID process-refund EF; IN_ANALYSIS blocks.", ["15", "14"], ["38", "44"], ["15.4–15.8", "14.4"]),
    (88, "Provider suspension immediate client notification + cron skip", "MMD on SUSPENDED; skip charge until ops.", ["14", "29"], ["44", "31"], ["14.8", "29.6"]),
    (89, "Platform rate limiting on webhook and manual charge endpoints", "platform_rate_limits in EF/RPC.", ["24"], ["66", "67"], ["24.4"]),
    (90, "Vault secrets provisioning runbook and .env.example sync", "INSTALLMENT_SIGNING_SECRET, NETCRED_*, webhook secret documented.", ["2", "24", "25"], ["4"], ["2.3", "24.5"]),
    (91, "payment_audit_log monthly partitioning strategy (optional phase)", "If volume warrants §9.4.", ["26"], ["13"], ["9.4"]),
    (92, "pgTAP comprehensive payment concurrency suite", "SKIP LOCKED double-worker simulation; accept_proposal idempotency.", ["23"], ["28", "25"], ["23.1", "23.4"]),
    (93, "Deno integration tests for NetCredAdapter (mock GraphQL)", "Auth refresh, referenceCode conflict, null getTransaction.", ["1", "2", "10"], ["61", "62"], ["1.3", "1.6", "10.8"]),
    (94, "Vitest tests for payments feature hooks and api layer", "Mock supabase.rpc and functions.invoke.", ["5", "8"], ["71", "76"], ["5.1", "8.6"]),
    (95, "E2E Playwright: checkout happy path (sandbox)", "Stepper through accept_proposal mock/sandbox.", ["5", "8"], ["76"], ["8.1"]),
    (96, "E2E Playwright: manual payment and FAILED_PERMANENT UX", "Button visibility and error states.", ["13"], ["79"], ["13.1"]),
    (97, "Failure injection tests: orphan lease recovery", "Simulate EF crash after claim; janitor recovery.", ["11", "23"], ["32", "56"], ["23.2"]),
    (98, "Failure injection tests: webhook duplicate and out-of-order delivery", "UNIQUE dedup; regression guard.", ["17", "18"], ["35", "67"], ["17.2", "17.3", "18.2"]),
    (99, "Load test: payment_claim_charge_batch at batch_size 10", "Measure lock contention under parallel cron (staging).", ["10", "23"], ["28"], ["10.9", "23.1"]),
    (100, "Feature flags and phased pg_cron enablement plan", "Crons registered inactive; enable payment_cron_schedule after shadow validation.", ["All"], ["51", "52", "53", "54", "55", "56", "57", "58"], ["Rollout ACs"]),
    (101, "Shadow execution: claim batch without NetCred (dry-run mode)", "Optional RPC flag logs would-charge rows.", ["10"], ["28", "65"], ["10.1"]),
    (102, "Production rollout checklist: enable crons sequentially", "Order: janitor → webhook retry → reconcile → notify → auto-cancel → charge → onboarding.", ["All"], ["100"], ["Operational validation"]),
    (103, "Rollback runbook: disable pg_cron jobs and drain queues", "Document payment_cron unschedule steps.", ["All"], ["100"], ["Rollback validation"]),
    (104, "Business docs sync: update docs/business/ for payment flows", "Per business-docs-sync-after-code-changes rule.", ["All"], ["76"], ["Product documentation"]),
    (105, "Operator runbook: dead letter reset and audit reconstruction", "Wire admin tools to RPCs 49–50.", ["19", "22"], ["49", "50"], ["19.4", "22.4"]),
]

EXTRA_TASKS = [
    (106, "Migration: KYC document Storage bucket and RLS policies", "Private bucket for identity/address/corporate docs; owner-prefix paths aligned with provider_profiles_private URLs per design.md §3.11.", ["3"], ["15"], ["3.2", "3.3"]),
    (107, "Register payment Edge Functions in `supabase/config.toml`", "All seven functions with correct verify_jwt (false for netcred-webhook + cron-invoked); CORS; entrypoints.", ["16", "24"], ["64", "67"], ["16.1"]),
    (108, "Implement RPC `payment_confirm_service_completed` (client completion)", "EXECUTED→COMPLETED by client; audit SERVICE_COMPLETED; MMD to provider; dispute does not block.", ["32"], ["48", "47"], ["32.2", "32.4"]),
    (109, "MMD event catalog registration for payment notification types", "Register templates/keys: UPCOMING_CHARGE, CHARGE_SUCCEEDED, CHARGE_FAILED, FAILED_PERMANENT, PROVIDER_KYC_SUBMITTED, DISPUTE, auto-cancel, accept-pending-payment provider push.", ["12", "30", "33"], ["31"], ["12.1", "1.7.9"]),
    (110, "Provider post-accept pending-payment push (accept_proposal side effect)", "Enqueue MMD after accept: *cliente aceitou — aguardando confirmação* — NEVER trabalho confirmado before PAID.", ["8", "12"], ["25", "109"], ["1.7.2", "8.1"]),
    (111, "Dispute in-app badge UI (client + provider)", "When payment_schedules.is_disputed=true show neutral badge; no auto status change.", ["18"], ["35", "81"], ["18.4"]),
    (112, "Provider receivables UI: D+30 settlement disclosure from paid_at", "Show estimated bank receipt; clarify COMPLETED does not trigger transfer.", ["32"], ["81"], ["32.5"]),
    (113, "IN_ANALYSIS T-12h auto-cancel gateway void I/O path", "Thin EF or extend process-refund/charge void when payment_auto_cancel_services flags IN_ANALYSIS overdue reconcile.", ["14", "15"], ["44", "68"], ["14.5", "14.6"]),
    (114, "Update `.env.example` and Edge `.env.example` with payment secrets keys", "Document NETCRED_*, VITE_CLEARSALE_APP_KEY placeholders; Vault-only for secrets.", ["24", "31"], ["90"], ["24.6", "31.5"]),
    (115, "pgTAP: RLS deny-all matrix for all nine `payment_*` tables", "Automated tests per table: anon/authenticated/provider cross-access denied appropriately.", ["24", "26"], ["6", "14"], ["24.6", "26.9"]),
    (116, "pgTAP: `payment_claim_charge_batch` parallel session concurrency test", "Two sessions SKIP LOCKED — no duplicate lease on same schedule_id.", ["23"], ["28", "92"], ["23.1"]),
    (117, "pgTAP: installment HMAC tamper and expiry rejection", "Invalid signature and expired payload rejected by accept_proposal.", ["7", "8"], ["18", "25"], ["7.5", "8.1"]),
    (118, "pgTAP: webhook UNIQUE dedup and is_duplicate flag", "Second insert same gateway_event_id → controlled duplicate path.", ["17"], ["33", "98"], ["17.1", "17.2"]),
    (119, "pgTAP: auto-cancel idempotency on already CANCELLED service", "Second cron pass no-op without duplicate audit/notifications.", ["14"], ["44", "52"], ["14.7"]),
    (120, "pgTAP: payment_auto_cancel IN_ANALYSIS before T-12h exclusion", "Record not cancelled when execution_at - now() > 12h and state IN_ANALYSIS.", ["14"], ["44"], ["14.4"]),
    (121, "Deno test: `netcred-webhook` HMAC timingSafeEqual and 401 path", "Invalid signature → FAILED INVALID_SIGNATURE; no state mutation beyond ingest.", ["16", "24"], ["67"], ["16.2", "16.3", "24.3"]),
    (122, "Deno test: `schedule-netcred-charges` per-schedule error isolation", "One failure does not abort batch; Sentry span per schedule.", ["10", "21"], ["65"], ["10.9", "21.2"]),
    (123, "Feature API: `payments/api/checkout.api.ts` RPC wrappers", "Thin wrappers for payment_get_checkout_step_requirements, payment_calculate_installment_options, accept_proposal payment params.", ["5", "7", "8"], ["60", "18", "25"], ["5.1", "7.1", "8.1"]),
    (124, "Feature API: `payments/api/cards.api.ts` and `charges.api.ts`", "tokenize invoke, manual-charge invoke, payment_update_method, payment_revoke_client_card_token.", ["6", "13", "28"], ["60", "20", "22", "23"], ["6.1", "13.2", "28.2"]),
    (125, "Router: lazy payment/checkout routes and guards", "Integrate checkout stepper and manual payment into `router.tsx` with auth guards per routing-and-mobile-navigation rule.", ["5", "13"], ["71", "79"], ["13.1"]),
    (126, "Implement `payment_enqueue_notifications` MMD payload builders", "Structured payload per event type with bypass priority flags for FAILED_PERMANENT and PAID urgent provider path.", ["12", "33"], ["31", "109"], ["12.1", "12.3", "33.2"]),
    (127, "Audit trigger: prevent UPDATE/DELETE on `payment_audit_log` and `payment_attempts`", "DB-level immutability enforcement beyond GRANT REVOKE.", ["22"], ["10", "13", "84"], ["22.5"]),
    (128, "Staging soak test: 72h cron + webhook + reconcile loop", "Operational validation before Phase E rollout.", ["All"], ["100", "102"], ["Rollout validation"]),
    (129, "Chaos test: NetCred tokenAuth failure blocks charge with FAILED not count increment", "Verify Req 2 AC4 semantics end-to-end.", ["2", "11"], ["62", "65", "29"], ["2.4"]),
    (130, "Post-rollout monitoring dashboard: `job_runs` payment_* job health", "Ops query pack: finished_at IS NULL, error_count>0, metadata.fatal_error.", ["21"], ["51", "58", "82"], ["21.1"]),
]

LATE_TASKS.extend(EXTRA_TASKS)

for num, title, desc, reqs, deps, acs in LATE_TASKS:
    TASKS.append(t(
        num, title, desc,
        ["Follow design.md §8–§11", "Coordinate with SRE for alert routing"],
        ["Tests/docs/migrations as listed in deliverables"],
        ["Artifacts per task title"],
        [f"Task {d}" for d in deps],
        ["Operational safety preserved"],
        ["Graceful degradation paths documented"],
        ["Metrics and Sentry dashboards"],
        ["RLS and rate limits verified"],
        ["Index and batch tuning"],
        [reqs] if isinstance(reqs, str) else reqs,
        acs,
    ))


HEADER = dedent("""
# Implementation Tasks — Prestway Payment System

> **Source of truth:** [`design.md`](./design.md) (v2.11) + [`payment-system-requirements.md`](./payment-system-requirements.md) (Req 1–33)
> **Generated:** engineering execution plan for squad linearization
> **Architecture:** RPC-first PostgreSQL orchestration + seven Edge Functions (PCI/external I/O only)

---

## Execution Strategy

### Implementation strategy

The payment subsystem SHALL be delivered **incrementally by operational boundary**, not by user-story alone. PostgreSQL owns authoritative state, leases, HMAC validation (Vault), webhook state machines, batch crons (`payment_cron_*` → `job_runs`), and MMD enqueue. Edge Functions remain **thin I/O connectors** — no queues, leases, or state transitions in Deno memory.

**Mandatory engineering gates (every task):**

1. **Migration safety:** new files in `supabase/migrations/` MUST use timestamps **after** the current mainline latest (`20260723120000_*` at plan authoring). Never edit applied migrations.
2. **Extended RPC safety:** before touching `accept_proposal`, `match_provider_jobs`, or `cns_initiate_conversation`, dump live bodies from local Postgres (`pg_get_functiondef`) — design.md §5.2.
3. **Same-migration invariants:** CREATE TABLE + RLS + indexes + REVOKE/GRANT in one migration; CREATE RPC + EXECUTE grants in one migration.
4. **Cron invariant:** pg_cron schedules **`SELECT public.payment_cron_*()`** only — never batch RPCs or EF URLs directly (§6.4).
5. **Project patterns:** feature code under `src/features/payments/`; tests via `yarn test:run` / `yarn test:deno` / pgTAP; Node **24.13** via nvm.

### Execution order (phases)

| Order | Phase | Unblocks |
|---|---|---|
| 1 | Foundation | Scheduling helper, constants, enum extensions |
| 2 | Persistence | All `payment_*` tables + RLS + views |
| 3 | Core transactional logic | Fee RPCs, KYC, accept_proposal evolution, update_method |
| 4 | Scheduling | claim/commit/begin_manual, lease janitor |
| 5 | Async orchestration | Webhook ingest/process/queue |
| 6 | Workers | pg_cron wrappers + job_runs |
| 7 | APIs | Seven Edge Functions + NetCredAdapter |
| 8 | Observability | Sentry, audit, payment_events |
| 9 | Recovery | Reconcile, dead letter, operator RPCs |
| 10 | Reliability | Auto-cancel, notify, auto-complete batches |
| 11 | Security | Rate limits, Vault, PCI verification |
| 12 | Performance | Index validation, partitioning (optional) |
| 13 | Verification | pgTAP, Deno, Vitest, E2E, failure injection |
| 14 | Rollout | Feature flags, shadow mode, cron enablement |

### Transactional dependency graph (critical path)

```mermaid
graph LR
  A[payment_service_execution_at] --> B[payment_schedules]
  B --> C[payment_calculate_charge_amount]
  C --> D[payment_claim_charge_batch]
  D --> E[schedule-netcred-charges EF]
  E --> F[payment_commit_charge_outcome]
  F --> G[payment_enqueue_notifications]
  B --> H[accept_proposal evolution]
  I[payment_ingest_webhook_event] --> J[payment_process_webhook_event]
```

**Tasks that MUST land before any production charge:** Tasks 3, 4, 9, 17, 18, 25, 28, 29, 31, 51, 59, 61–65, 82, 92, 100.

### Rollout strategy

1. **Phase A (schema only):** Deploy migrations Tasks 2–16 with crons **unscheduled**.
2. **Phase B (RPC + EF in staging):** Enable Deno tests + pgTAP; run shadow claim (Task 101).
3. **Phase C (read paths):** Checkout UI + tokenize against sandbox NetCred.
4. **Phase D (async workers):** Enable `payment_cron_recover_orphaned_schedules`, `payment_cron_process_webhook_retry`, `payment_cron_reconcile_netcred_payments`.
5. **Phase E (money movement):** Enable `payment_cron_schedule_netcred_charges` with monitoring.
6. **Phase F (business batches):** auto-cancel, notify, auto-complete, onboarding detection.

### Validation strategy

- **Unit:** fee formula parity between `payment_calculate_installment_options` and `payment_calculate_charge_amount` (Task 92).
- **Concurrency:** parallel `payment_claim_charge_batch` sessions (Task 92, 99).
- **Idempotency:** webhook UNIQUE + accept_proposal idempotency_key (Tasks 98, 92).
- **Failure injection:** orphan lease, duplicate webhook, referenceCode conflict (Tasks 97, 98, 93).

### Recovery strategy

- **Orphan leases:** `payment_cron_recover_orphaned_schedules` every 30m (Task 56).
- **Webhook failures:** exponential backoff → DEAD_LETTER → operator reset RPC (Tasks 55, 49, 105).
- **Gateway timeout:** `getTransaction` before re-charge (Tasks 65, 93).
- **Rollback:** unschedule pg_cron jobs; EF deploy previous version; forward-only DB migrations (Task 103).

### Risk isolation

- Keep **notification failures** out of payment TX (async MMD only).
- Keep **PCI** isolated to `tokenize-payment-card` EF.
- **IN_ANALYSIS** blocks client cancel before T-12h; separate path at T-12h (Tasks 44, 87).
- **Provider SUSPENDED** skips charge + dedicated cancel reason (Tasks 44, 88).

---

""")


PHASES = [
    ("Phase 1: Database Foundation", 1, 5),
    ("Phase 2: Persistence Layer", 6, 16),
    ("Phase 3: Core Transactional Logic", 17, 27),
    ("Phase 4: Scheduling Engine", 28, 32),
    ("Phase 5: Webhook & Async Orchestration", 33, 43),
    ("Phase 6: Batch Processors & Cron Targets", 44, 50),
    ("Phase 7: pg_cron Wrappers & Distributed Coordination", 51, 59),
    ("Phase 8: Edge Functions & Gateway Adapter", 60, 70),
    ("Phase 9: Application Layer & Checkout UX", 71, 81),
    ("Phase 10: Observability & Auditability", 82, 85),
    ("Phase 11: Recovery, Reliability & Cross-Feature Integration", 86, 91),
    ("Phase 12: Security Hardening & Performance", 89, 91),
    ("Phase 13: Verification & Quality Gates", 92, 99),
    ("Phase 14: Rollout & Operational Readiness", 100, 105),
    ("Phase 15: Supplementary Integration & Extended Verification", 106, 130),
]


def main() -> None:
    lines = [HEADER]
    task_by_num = {i + 1: TASKS[i] for i in range(len(TASKS))}

    for phase_name, start, end in PHASES:
        lines.append(f"\n# {phase_name}\n")
        for n in range(start, end + 1):
            if n in task_by_num:
                lines.append(task_by_num[n])

    lines.append(dedent("""

---

## Appendix A: Requirement → Task Index (primary mapping)

| Req | Primary tasks |
|---|---|
| 1 | 60, 61, 63, 65–70 |
| 2 | 6, 62, 90 |
| 3 | 15, 21, 77 |
| 4 | 41–43, 57, 69 |
| 5 | 19, 71–74 |
| 6 | 7, 20, 64, 74 |
| 7 | 17, 18, 75 |
| 8 | 25, 23, 76 |
| 9 | 9, 24, 25, 86 |
| 10 | 28, 29, 51, 65, 101 |
| 11 | 28, 29, 30, 32, 56 |
| 12 | 29, 31, 65, 66 |
| 13 | 30, 66, 79 |
| 14 | 44, 52, 87, 88 |
| 15 | 38, 68, 87 |
| 16 | 33, 67 |
| 17 | 11, 35, 67, 98 |
| 18 | 35, 55 |
| 19 | 12, 36, 37, 49, 55, 105 |
| 20 | 39, 40, 58, 70 |
| 21 | 82 |
| 22 | 13, 83, 84 |
| 23 | 28, 30, 32, 56, 92, 97, 99 |
| 24 | 7, 64, 67, 89, 90 |
| 25 | 4, 17, 18 |
| 26 | 2, 5–16 |
| 27 | 75, 76 |
| 28 | 22, 78 |
| 29 | 26, 27, 25, 88 |
| 30 | 14, 85 |
| 31 | 73, 76, 79, 66 |
| 32 | 48, 47, 54, 80 |
| 33 | 45, 46, 53, 126 |

## Appendix B: Seven Edge Functions checklist

| EF | Task |
|---|---|
| `tokenize-payment-card` | 64 |
| `schedule-netcred-charges` | 65 |
| `manual-charge-payment` | 66 |
| `netcred-webhook` | 67 |
| `process-refund` | 68 |
| `detect-netcred-onboarding` | 69 |
| `reconcile-netcred-payments` | 70 |

## Appendix C: pg_cron wrapper checklist

| Wrapper | Task | Schedule (UTC) |
|---|---|---|
| `payment_cron_schedule_netcred_charges` | 51 | `0 9,15,21,3 * * *` |
| `payment_cron_auto_cancel_unpaid_services` | 52 | `15 9,15,21,3 * * *` |
| `payment_cron_notify_upcoming_charges` | 53 | `30 9,15,21,3 * * *` |
| `payment_cron_auto_complete_executed_services` | 54 | `45 9,15,21,3 * * *` |
| `payment_cron_process_webhook_retry` | 55 | `*/5 * * * *` |
| `payment_cron_recover_orphaned_schedules` | 56 | `*/30 * * * *` |
| `payment_cron_detect_netcred_onboarding` | 57 | `0 10 * * *` |
| `payment_cron_reconcile_netcred_payments` | 58 | `*/30 * * * *` |

---

"""))

    traceability_md, csv_path = generate_traceability(Path(__file__).parent)
    lines.append(traceability_md)

    lines.append(dedent("""
## Appendix F: Regenerating this document

The task list and traceability matrix are generated from [`_generate_tasks.py`](./_generate_tasks.py) and [`_traceability.py`](./_traceability.py):

```bash
python3 docs/payment-system/_generate_tasks.py
```

Outputs:
- `tasks.md` — implementation tasks + appendices
- `traceability-matrix.csv` — AC → task mapping for Jira/Linear import

Edit the generators to add tasks or AC mappings; do not hand-edit `tasks.md` / CSV at scale.

---

*Document aligned with `design.md` v2.11. Update when design/requirements change or new payment RPCs/crons are added.*
"""))

    OUTPUT.write_text("".join(lines), encoding="utf-8")
    print(f"Wrote {OUTPUT} ({len(lines)} sections, {len(TASKS)} tasks)")


if __name__ == "__main__":
    main()
