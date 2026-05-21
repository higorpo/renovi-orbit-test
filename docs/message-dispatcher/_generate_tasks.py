#!/usr/bin/env python3
"""Generate docs/message-dispatcher/tasks.md from structured task definitions."""

from __future__ import annotations

OUT = "docs/message-dispatcher/tasks.md"

EXEC_STRATEGY = """# Implementation Tasks - Multichannel Message Dispatcher (MMD)

## Execution Strategy

### Implementation thesis

MMD SHALL be delivered as a **database-centric transactional outbox** with a persisted finite-state machine (FSM) in PostgreSQL schema `message_dispatcher`. All atomic transitions, eligibility evaluation, rate limits, queue checkout, lease semantics, retry scheduling, and audit append MUST occur inside **PL/pgSQL RPCs** under ACID transactions (design §1.1). Edge Functions SHALL remain **stateless I/O adapters** only.

### Execution order (mandatory waves)

| Wave | Phases | Unblocks |
|------|--------|----------|
| W0 | Phase 1–2: schema, enums, tables, indexes, RLS, FSM matrix | All RPCs and triggers |
| W1 | Phase 3: `message_dispatcher_ingest`, `message_dispatcher_cancel` | Producer integration, Req. 1/4/5 |
| W2 | Phase 4–5: scheduling RPCs, `checkout_batch`, delivery fan-out | Worker dequeue, Req. 3/4 |
| W3 | Phase 6–7: Edge worker, `report_delivery_outcome`, HTTP classification | End-to-end delivery, Req. 7 |
| W4 | Phase 7–8: `pg_cron`/`pg_net`, webhook, audit timeline | Async ops, Req. 6 |
| W5 | Phase 9–11: recovery runbooks, security hardening, perf tests | Production readiness |
| W6 | Phase 12: E2E, Orbit integration, phased rollout | GA |

### Architectural dependencies (hard gates)

- Schema `message_dispatcher` MUST exist before any MMD DDL (design §2.0).
- `message_dispatch_status_allowed()` MUST precede `message_dispatches_validate_transition` trigger (§3.3.1, §4.8).
- `message_dispatcher_user_limits` MUST precede `message_dispatcher_ingest` (Req. 1 AC3 — `FOR UPDATE`).
- `message_dispatcher_ingest` MUST deploy before cron activates rows to `QUEUED`.
- `message_dispatcher_checkout_batch` MUST deploy before `message-dispatcher-worker`.
- `message_dispatcher_report_delivery_outcome` MUST deploy before worker provider I/O.
- Audit trigger SHOULD ship in same release window as first RPC migration (Req. 6 AC1).
- `mmd_invoke_worker` MUST remain **disabled** until worker auth + secrets validated.

### Transactional dependency graph

```
ingest: BEGIN → FOR UPDATE user_limits → COUNT quotas → INSERT dispatch → COMMIT
activate_scheduled: batch SCHEDULED→PENDING_EVALUATION → evaluate→QUEUED
checkout_batch: SKIP LOCKED → PROCESSING+lease → resolve auth.users/beacons → INSERT deliveries → COMMIT
report_delivery_outcome: guard PROCESSING → UPDATE parent+deliveries → audit trigger → COMMIT
reconcile_vendor_event: INSERT vendor_events → UPDATE dispatch (idempotent)
reclaim_leases → promote_retries (cron order: reclaim before promote recommended)
```

### Rollout strategy

1. **Phase A (dark DB):** Migrations `20260621100000`–`20260621100300`; RPCs live; cron activate/promote/reclaim **ON**; `mmd_invoke_worker` **OFF**.
2. **Phase B (shadow worker):** Deploy Edge worker; manual `service_role` invoke `p_limit=1`; zero producer traffic.
3. **Phase C (canary):** Single `source_system` ingest; alert on `QUEUED` lag and `FAILED_TERMINAL` rate >5%/15m.
4. **Phase D (GA):** Enable `pg_net` worker cron (≥15s); Resend webhook; enforce client `idempotency_key`.

### Validation strategy

- **SQL/unit:** FSM matrix illegal transitions; UNIQUE idempotency replay; backoff `power(2,n)*60s`.
- **DB integration:** 5 parallel `checkout_batch`; concurrent ingest 1 quota slot; cancel vs checkout race.
- **Edge integration:** HTTP 429→`FAILED_RETRYABLE`; 400 invalid token→`FAILED_TERMINAL` + beacon disable.
- **E2E:** ingest→cron→worker→mock provider→`DELIVERED`; webhook reconcile path.
- **Chaos:** worker wall-clock >30s lease without report → janitor reclaim.

### Risk isolation and rollback

| Risk | Mitigation |
|------|------------|
| Double send | SKIP LOCKED + lease + completion status guard + provider idempotency keys |
| Quota breach | `FOR UPDATE` on `user_limits` + live COUNT |
| Audit gap | Forward-fix only; never UPDATE audit rows |
| Provider outage | `FAILED_RETRYABLE` depth monitoring |
| Rollback | `cron.unschedule` worker → revoke checkout/report EXECUTE → retain schema/audit |

### Observability-critical path (pre-canary)

Audit trigger, `correlation_id` structured logs, queue lag SQL, `lease_expired` reclaim counter.

### Security-critical path (pre-webhook URL)

RLS owner SELECT, no authenticated dispatch mutation, HMAC webhook, Edge-only secrets.

---

"""


def task(
    n: int,
    title: str,
    phase: int,
    desc: str,
    resp: list[str],
    impl: list[str],
    deliv: list[str],
    deps: list[str],
    runtime: list[str],
    failure: list[str],
    obs: list[str],
    sec: list[str],
    perf: list[str],
    reqs: str,
    acs: str,
) -> dict:
    return {
        "n": n,
        "title": title,
        "phase": phase,
        "desc": desc,
        "resp": resp,
        "impl": impl,
        "deliv": deliv,
        "deps": deps,
        "runtime": runtime,
        "failure": failure,
        "obs": obs,
        "sec": sec,
        "perf": perf,
        "reqs": reqs,
        "acs": acs,
    }


# fmt: off
TASKS = [
    task(1, "Create schema `message_dispatcher` and default privileges", 1,
         "Execute `CREATE SCHEMA IF NOT EXISTS message_dispatcher` as the first statement in migration `20260621100000`. Configure default privileges and grants so MMD-owned objects are isolated from `public` domain tables while allowing controlled read paths for `authenticated` and full RPC access for `service_role`.",
         ["Establish namespace boundary for extraction and grant governance", "Prevent accidental `public` DDL on dispatcher objects", "Document Supabase PostgREST schema exposure"],
         ["`CREATE SCHEMA IF NOT EXISTS message_dispatcher`", "REVOKE ALL ON SCHEMA message_dispatcher FROM PUBLIC; GRANT USAGE TO service_role, authenticated", "ALTER DEFAULT PRIVILEGES IN SCHEMA message_dispatcher GRANT SELECT ON TABLES TO authenticated", "Comment block referencing design §2.0 API exposure checklist"],
         ["Migration `20260621100000` header block", "Schema creation SQL", "Grant matrix in migration README comment"],
         ["None — W0 entry gate"],
         ["Schema existence is hard prerequisite for all subsequent MMD migrations"],
         ["Idempotent `IF NOT EXISTS` for re-run safety on branched environments"],
         ["N/A"],
         ["No client writes without explicit GRANT; service_role owns mutations via RPC"],
         ["N/A"],
         "Design §2.0", "—"),

    task(2, "Create enums `message_channel`, `message_dispatch_status`, `message_delivery_outcome`", 1,
         "Define PostgreSQL ENUM types in schema `message_dispatcher` per design §3.1. `message_channel` MUST contain only `email` and `push` — this is the primary gate rejecting SMS and unconfigured channels at persistence boundary (Req. 2 AC3).",
         ["Encode allowed channels at type level", "Encode eight-state parent FSM", "Encode per-delivery child outcomes for push fan-out"],
         ["`CREATE TYPE message_dispatcher.message_channel AS ENUM ('email','push')`", "`message_dispatch_status`: PENDING_EVALUATION, SCHEDULED, CANCELED, QUEUED, PROCESSING, DELIVERED, FAILED_RETRYABLE, FAILED_TERMINAL", "`message_delivery_outcome`: pending, sent, failed_retryable, failed_terminal"],
         ["Three ENUM definitions in migration #1", "Type comments documenting terminal vs transient states"],
         ["Task 1"],
         ["Enum values immutable without forward migration", "Channel rejection occurs before Edge CPU spend"],
         ["Adding enum value requires `ALTER TYPE ... ADD VALUE` migration with deploy ordering"],
         ["N/A"],
         ["Channel allowlist is first anti-abuse boundary"],
         ["Enum comparison avoids text CHECK overhead on hot paths"],
         "2", "Req.2 AC3"),

    task(3, "Create table `message_templates`", 1,
         "Create registry table `message_dispatcher.message_templates` with composite PRIMARY KEY `(template_key, channel)`, `variable_schema jsonb` (JSON Schema subset), `subject_template`, `body_template`, and `active boolean`. This table is the authority for ingest-time template validation.",
         ["Store renderable template metadata", "Support composite FK from `message_dispatches`", "Reject inactive templates at ingest without Edge invocation"],
         ["DDL per design §3.2 including `variable_schema NOT NULL DEFAULT '{}'`", "COMMENT ON TABLE documenting inactive template rejection", "No RLS write for authenticated — ops seed via migration"],
         ["`message_templates` DDL in migration #1", "Composite PK constraint"],
         ["Task 2"],
         ["Template registry is read-mostly; read committed sufficient"],
         ["Missing template causes ingest rejection — no dispatch row or FAILED row per product choice (design: reject at evaluation)"],
         ["N/A"],
         ["Templates readable by authenticated; mutations only service_role/migrations"],
         ["Small cardinality table; no partial index required MVP"],
         "2", "Req.2 AC1, Req.2 AC3"),

    task(4, "Create table `message_dispatches` (FSM authority)", 1,
         "Create canonical dispatch table with FSM columns: `idempotency_key UUID NOT NULL UNIQUE`, `profile_id` FK→`public.profiles`, `channel`, `template_key`, `template_variables jsonb`, `status` default `PENDING_EVALUATION`, `scheduled_for`, `locked_until`, `locked_by`, `retry_count`, `max_retries`, `next_retry_at`, `correlation_id`, `vendor_message_id`, `failure_code`, `failure_reason`, `metadata`.",
         ["Persist Write-Ahead dispatch intent (Operational Architecture)", "Enforce idempotency UNIQUE constraint", "Foreign key to `message_templates(template_key, channel)`"],
         ["Full DDL design §3.3 including CHECK `retry_count >= 0` and `max_retries > 0`", "`correlation_id UUID NOT NULL DEFAULT gen_random_uuid()` for provider dedup", "`updated_at` column for trigger freshness", "Do NOT store recipient email or fcm_token on parent — resolved at checkout §2.6"],
         ["`message_dispatches` DDL", "UNIQUE constraint on `idempotency_key`", "FK to message_templates"],
         ["Task 2", "Task 3"],
         ["`idempotency_key` provides exactly-once business dispatch creation", "Recipient addresses resolved at checkout — not on parent row"],
         ["Duplicate idempotency_key INSERT fails UNIQUE — mapped to return-existing in ingest RPC"],
         ["correlation_id in all logs"],
         ["No direct authenticated UPDATE on status — RPC only"],
         ["Parent row is hot — partial indexes added in Task 9"],
         "5", "Req.5 AC1"),

    task(5, "Create table `message_dispatcher_user_limits`", 1,
         "Create per-profile serialization anchor `message_dispatcher_user_limits` with `email_count_24h`, `push_count_24h`, rolling `email_window_start`, `push_window_start`, `last_push_sent_at` for cooldown evaluation.",
         ["Serialize concurrent ingest for same profile (Req. 1 AC3)", "Maintain rolling 24h window metadata", "Anchor row for `SELECT ... FOR UPDATE`"],
         ["PK `profile_id` FK→`public.profiles ON DELETE CASCADE`", "Design §3.4 column set", "Upsert-on-first-ingest pattern documented for RPC"],
         ["`message_dispatcher_user_limits` DDL"],
         ["Task 4"],
         ["One limits row per profile — lock serializes all channel ingests for profile"],
         ["Lock hold time MUST remain short — ingest txn only"],
         ["N/A"],
         ["Row keyed by profile_id — tenant isolation via profile ownership"],
         ["Single-row lock per profile — acceptable at MVP ingest RPS"],
         "1", "Req.1 AC3"),

    task(6, "Create table `message_dispatch_deliveries`", 1,
         "Create child fan-out table for push with `dispatch_id`, `device_id`, `fcm_token_snapshot`, `outcome`, `vendor_error_code`, `vendor_response jsonb`, `attempt_no`, UNIQUE `(dispatch_id, device_id, attempt_no)`.",
         ["Snapshot FCM tokens at checkout for retry-stable I/O", "Track per-device outcomes for partial fan-out", "Support idempotent completion per delivery row"],
         ["DDL design §3.5", "UNIQUE (dispatch_id, device_id, attempt_no)", "ON DELETE CASCADE from parent dispatch"],
         ["`message_dispatch_deliveries` DDL"],
         ["Task 4"],
         ["`fcm_token_snapshot` immutable after checkout — Edge MUST NOT re-read live beacons during send"],
         ["Orphan delivery rows cascade-delete with parent"],
         ["Per-delivery outcome in report RPC"],
         ["RLS SELECT via dispatch owner join (Task 15)"],
         ["Fan-out capped at checkout (Task 50)"],
         "3", "Req.3 AC1"),

    task(7, "Create table `message_dispatcher_audit`", 1,
         "Create append-only audit table `message_dispatcher_audit` with `bigserial id`, `dispatch_id`, `profile_id`, `old_status`, `new_status`, `changed_by`, `correlation_id`, `delta jsonb`, `created_at`.",
         ["Immutable transition history for Req. 6", "Support sub-second support queries via composite indexes", "Growth-phase partitioning attachment point"],
         ["DDL design §3.6", "No UPDATE/DELETE grants for any role", "Indexes deferred to Task 19"],
         ["`message_dispatcher_audit` DDL"],
         ["Task 4"],
         ["Audit INSERT occurs in same transaction as parent UPDATE via trigger"],
         ["If trigger disabled — halt workers per design §8.5 recovery"],
         ["Support timeline RPC uses dispatch_id index"],
         ["Owner SELECT via profile_id RLS"],
         ["Monthly partitioning stub Task 110"],
         "6", "Req.6 AC1"),

    task(8, "Create table `message_dispatcher_vendor_events`", 1,
         "Create webhook ingress log with `vendor_event_id TEXT PRIMARY KEY`, `dispatch_id`, `vendor`, `event_type`, `payload jsonb`, `processed_at` for at-least-once webhook deduplication.",
         ["Dedup Resend webhook replays (Concurrency Req. 7)", "Forensic payload retention", "Idempotent reconcile entry point"],
         ["DDL design §3.7 with CHECK vendor IN ('resend','fcm')", "INSERT-only policy"],
         ["`message_dispatcher_vendor_events` DDL"],
         ["Task 4"],
         ["UNIQUE vendor_event_id → second webhook is 200 noop"],
         ["Duplicate INSERT ON CONFLICT DO NOTHING in reconcile RPC"],
         ["vendor_event_id in webhook logs"],
         ["Webhook signature verified in Edge before RPC"],
         ["Append-only growth — archive policy ops-defined"],
         "6", "Req.6 AC2"),

    task(9, "Create partial indexes on `message_dispatches`", 1,
         "Create five partial indexes: `queued_poll` (status=QUEUED), `scheduled_due` (SCHEDULED), `retry_due` (FAILED_RETRYABLE), `stale_lease` (PROCESSING), `profile_channel_created` for support analytics.",
         ["Enable index-only worker poll without full table scan", "Bound janitor query to PROCESSING+expired lease", "Support Req. 6 AC3 query performance"],
         ["Exact DDL from design §3.3.2 — note column order `(scheduled_for, created_at)` on queued index", "Run EXPLAIN in Task 106 to verify index usage", "Avoid redundant indexes on idempotency_key (UNIQUE already indexed)"],
         ["Five `CREATE INDEX ... WHERE status = ...` statements"],
         ["Task 4"],
         ["Checkout SCAN MUST use `message_dispatches_queued_poll_idx` at scale"],
         ["Reindex CONCURRENTLY if adding indexes to production with traffic"],
         ["Queue depth gauge queries use partial predicates"],
         ["N/A"],
         ["Hot QUEUED partition mitigation — ORDER BY + LIMIT in checkout"],
         "3", "Req.3 AC1, Req.6 AC3"),

    task(10, "Register `message_dispatcher` in Supabase API schema list", 1,
         "Configure Supabase project to expose schema `message_dispatcher` to PostgREST (or document thin `public` wrapper RPCs if schema list restricted). Publish engineering rule: features MUST call RPCs by name — never direct table INSERT/UPDATE on `message_dispatches.status`.",
         ["Enable REST RPC invocation for Orbit producers", "Document forbidden direct client mutations", "Align with feature-based API layer in Orbit"],
         ["Update `supabase/config.toml` or dashboard schema settings", "Add ADR note in migration comment", "Verify `rpc/message_dispatcher_ingest` reachable from CI smoke test"],
         ["Config change PR", "Developer guideline snippet in migration header"],
         ["Task 1"],
         ["RPC-only writes preserve FSM integrity"],
         ["Misconfigured schema exposure blocks integration tests — fail fast in CI"],
         ["N/A"],
         ["Reduces attack surface — no broad table GRANT to authenticated"],
         ["N/A"],
         "Design §2.0", "—"),

    task(11, "Implement `message_dispatch_status_allowed(from, to)` FSM matrix", 2,
         "Implement SQL function returning boolean for legal transitions per design §4.8 matrix. Include special case: `PROCESSING→QUEUED` allowed only for janitor/reclaim path (document in function comment). Terminal states `DELIVERED`, `CANCELED`, `FAILED_TERMINAL` have no outbound edges.",
         ["Centralize FSM rules for trigger and RPC assertions", "Prevent illegal cancel/checkout completion paths", "Map to SQLSTATE P0001 for API 409 mapping"],
         ["PL/pgSQL or SQL immutable function in schema message_dispatcher", "Cover all ✓ cells in design transition table §4.8", "Unit test matrix: iterate all pairs assert allowed/blocked"],
         ["Function `message_dispatch_status_allowed`", "pgTAP or SQL test file `fsm_matrix_test.sql`"],
         ["Task 4"],
         ["Deterministic transition validation on every UPDATE"],
         ["Illegal transition raises exception — txn rollback, no partial audit"],
         ["N/A"],
         ["FSM guard is authoritative — Edge cannot bypass"],
         ["O(1) enum comparison per transition check"],
         "4", "Req.4 AC3"),

    task(12, "Implement `message_dispatches_validate_transition()` BEFORE UPDATE trigger", 2,
         "Attach BEFORE UPDATE trigger on `message_dispatches` invoking `message_dispatch_status_allowed(old.status, new.status)` when `status` changes; raise `invalid status transition` with ERRCODE P0001.",
         ["Enforce FSM at row level even if RPC has bug", "Protect against accidental service_role direct UPDATE", "Complement RPC-level guards"],
         ["Trigger function design §3.3.1", "`CREATE TRIGGER` on message_dispatches", "Test illegal PROCESSING→DELIVERED skip (must fail)"],
         ["Trigger function + TRIGGER attachment in migration #2"],
         ["Task 11"],
         ["Every status mutation validated — atomic with UPDATE"],
         ["Rollback entire UPDATE on illegal transition — no audit row for failed transition"],
         ["Failed transition attempts should log at RPC layer"],
         ["Defense in depth with completion RPC WHERE clauses"],
         ["Negligible overhead vs network I/O"],
         "4", "Req.4 AC3"),

    task(43, "Implement `message_dispatcher_checkout_batch` SKIP LOCKED CTE", 5,
         "Implement service_role RPC that selects eligible `QUEUED` rows (`scheduled_for <= now()`) using CTE + `FOR UPDATE SKIP LOCKED` + `LIMIT p_limit`, then UPDATE to `PROCESSING` in same transaction.",
         ["Exclusive worker claim without blocking peers", "Prevent double checkout under horizontal Edge scaling", "Return empty set when queue drained"],
         ["Exact SQL core design §4.3 checkout CTE", "Default `p_limit := 25`; reject `p_limit > 50`", "ORDER BY scheduled_for, created_at for fairness"],
         ["RPC `message_dispatcher_checkout_batch`", "Concurrency test Task 103"],
         ["Task 9", "Task 11", "Task 4"],
         ["At-most-one concurrent owner per row while `locked_until > now()`", "SKIP LOCKED ensures disjoint batches across N workers"],
         ["Worker crash before report → janitor reclaims (Task 37)", "Empty batch is success — not error"],
         ["Histogram `mmd_checkout_latency_ms`", "Log batch size and worker_id"],
         ["service_role EXECUTE only (Task 51)"],
         ["MUST use `message_dispatches_queued_poll_idx`"],
         "3", "Req.3 AC1"),

    task(44, "Implement checkout atomic lease (`locked_until`, `locked_by`)", 5,
         "In same transaction as SKIP LOCKED update, set `status='PROCESSING'`, `locked_until=now()+interval '30 seconds'`, `locked_by=p_worker_id`, `updated_at=now()`.",
         ["Establish ownership semantics (Operational Architecture)", "Block re-selection until lease expiry", "Align with Edge HTTP timeout 25s (Task 60)"],
         ["Lease duration from `platform_constants.message_dispatcher.lease_seconds` default 30", "Document optional Phase 2 `extend_lease` not in MVP", "Re-invocation same worker before expiry returns empty for those ids"],
         ["Lease fields set in checkout_batch UPDATE RETURNING"],
         ["Task 43"],
         ["Atomic lease assignment — no window where row is PROCESSING without locked_until", "At-most-once concurrent processing per dispatch"],
         ["Lease expiry → reclaim_leases (Task 37)", "Do not renew lease in MVP unless extend_lease added"],
         ["Metric `mmd_lease_reclaims`", "Alert stale PROCESSING count"],
         ["locked_by must match on report (Task 62)"],
         ["30s lease >> cron 60s granularity worst-case reclaim delay"],
         "3", "Req.3 AC2"),

    task(21, "Implement ingest: reject NULL `p_idempotency_key`", 3,
         "At start of `message_dispatcher_ingest`, validate `p_idempotency_key IS NOT NULL`; raise exception mapped to HTTP 400 without INSERT (Req. 5 AC2).",
         ["Mandatory idempotency protocol enforcement", "Fail fast before acquiring user_limits lock", "Clear integrator contract"],
         ["`IF p_idempotency_key IS NULL THEN RAISE EXCEPTION ... USING ERRCODE '22023'`", "PostgREST maps to 400", "No side effects on NULL key path"],
         ["Branch in `message_dispatcher_ingest` migration #2", "API test: missing key → 400"],
         ["Task 4", "Task 5"],
         ["No row created — deterministic rejection"],
         ["Client MUST retry with new key only for new intent — same key on 400 N/A"],
         ["Counter `mmd_ingest_rejected_total{reason=missing_idempotency}`"],
         ["Prevents anonymous replay floods"],
         ["Avoids useless lock on user_limits"],
         "5", "Req.5 AC2"),

    task(24, "Implement ingest: email 24h quota COUNT → terminal/canceled", 3,
         "Inside ingest txn after `FOR UPDATE` on user_limits, COUNT `message_dispatches` where `channel='email'` AND `status IN ('DELIVERED','QUEUED','PROCESSING','SCHEDULED')` AND `created_at > now()-interval '24 hours'`. If count >= `email_daily_limit` (default 5), INSERT dispatch with `CANCELED` or `FAILED_TERMINAL` and `metadata.rate_limit` JSON.",
         ["Enforce Req. 1 AC1 email cap", "Count in-flight scheduled toward quota", "Log restrictive metadata for support"],
         ["Use live COUNT not cache-only — counters on user_limits are optimization only per design §3.4", "Read limit from platform_constants", "Set `failure_code='email_daily_quota_exceeded'` when terminal"],
         ["Quota branch in ingest RPC", "Test: 5th email in window blocked"],
         ["Task 23", "Task 17"],
         ["Quota check atomic with insert under same profile lock", "Parallel ingests cannot exceed cap"],
         ["No retry — terminal/canceled is final for that dispatch"],
         ["Audit captures CANCELED transition", "metadata.rate_limit in delta"],
         ["Quota applies per profile_id"],
         ["COUNT uses `profile_channel_created` index"],
         "1", "Req.1 AC1"),

    task(26, "Implement ingest: push 20min cooldown → SCHEDULED reschedule", 3,
         "When `channel='push'` and `now() < last_push_sent_at + interval '20 minutes'`, INSERT with `status='SCHEDULED'` and `scheduled_for = last_push_sent_at + 20 minutes` (NOT reject) per Req. 1 AC2.",
         ["Temporal engagement safety", "Defer rather than drop push intent", "Exclude from QUEUED poll until rescheduled time"],
         ["Read `last_push_sent_at` from user_limits under lock", "Update scheduled_for on inserted row", "Partial index `scheduled_due` used by activate cron"],
         ["Cooldown branch in ingest", "Test: push at 10:05 after 10:00 send → scheduled_for 10:20"],
         ["Task 23", "Task 25"],
         ["Cooldown evaluation serialized per profile", "Future SCHEDULED invisible to checkout_batch"],
         ["N/A — not a failure"],
         ["Audit shows scheduled_for delta"],
         ["Per-profile cooldown"],
         ["scheduled_due index for cron activation"],
         "1", "Req.1 AC2"),

    task(37, "Implement `message_dispatcher_reclaim_leases` janitor RPC", 4,
         "Cron-invoked RPC: UPDATE rows `status='PROCESSING' AND locked_until < now()` SET status to `FAILED_RETRYABLE` or `FAILED_TERMINAL` based on `retry_count >= max_retries`, compute `next_retry_at` via backoff helper, clear lease fields, set `failure_code=coalesce(failure_code,'lease_expired')`.",
         ["Orphan recovery when Edge dies without report (Req. 3 AC3)", "Bridge at-least-once processing to safe re-queue", "Prevent indefinite PROCESSING staleness"],
         ["SQL design §4.9 exactly", "Chain with promote_retries in ops runbook", "Do not increment retry_count on lease-only reclaim unless product specifies"],
         ["RPC `message_dispatcher_reclaim_leases`", "pg_cron job Task 42", "Integration test Task 88"],
         ["Task 36", "Task 11"],
         ["Worst-case zombie visibility: lease 30s + cron 60s granularity", "Reclaimed rows become eligible for retry pipeline"],
         ["If max_retries exceeded → FAILED_TERMINAL not requeued", "metadata orphan_recoveries optional future"],
         ["Counter `mmd_lease_reclaims`", "Alert lease_expired >100/min"],
         ["service_role only"],
         ["Uses `message_dispatches_stale_lease_idx`"],
         "3", "Req.3 AC3"),

    task(63, "Implement `report_delivery_outcome` retryable failure path", 7,
         "On Edge classification retryable (429,502,503,timeout), RPC sets `status='FAILED_RETRYABLE'`, increments `retry_count`, sets `next_retry_at = now() + power(2, retry_count) * interval '60 seconds'` per Req. 7 AC1, clears lease.",
         ["Persist backoff in DB — Edge holds no retry state", "Coordinate with promote_retries cron", "Survive Edge cold start"],
         ["Shared helper `message_dispatcher_compute_next_retry_at(retry_count)`", "Clear locked_until, locked_by on failure", "Store http_status in metadata"],
         ["Retryable branch in report RPC", "Test Task 89"],
         ["Task 36", "Task 61"],
         ["Backoff monotonic — retry_count only increases", "promote_retries moves to QUEUED when due"],
         ["After max_retries → Task 65 terminal path", "Provider outage creates retry backlog — monitor depth"],
         ["Gauge `mmd_retryable_failures`", "Histogram time-to-promote"],
         ["service_role only"],
         ["Batch promote 500 rows SKIP LOCKED at cron"],
         "7", "Req.7 AC1"),

    task(58, "Implement worker Resend HTTP with `Idempotency-Key: correlation_id`", 6,
         "Edge worker sends email via Resend API using **only** `recipient_email` from checkout payload; set header `Idempotency-Key: {correlation_id}`; never accept client-supplied email address.",
         ["Provider-side dedup on worker retry (Req. 5 AC3)", "Anti-corruption for recipient resolution", "Synchronous delivery attempt within lease window"],
         ["RESEND_API_KEY from Edge env", "POST /emails with rendered HTML from Task 56", "Map response vendor id to report RPC"],
         ["`message-dispatcher-worker` Resend module", "Contract test with mock API"],
         ["Task 56", "Task 55", "Task 45"],
         ["At-least-once Resend semantics mitigated by idempotency header", "Same correlation_id on retry of same dispatch"],
         ["429/503 → report retryable (Task 68)", "Hard bounce may arrive via webhook later"],
         ["Log correlation_id, dispatch_id, http_status", "Sentry span `provider_http`"],
         ["recipient_email from DB only"],
         ["25s HTTP timeout (Task 60)"],
         "5", "Req.5 AC3"),

    task(74, "Implement `message_dispatcher_reconcile_vendor_event` RPC", 8,
         "Service_role RPC: INSERT into `message_dispatcher_vendor_events` with `vendor_event_id`; on conflict return success noop; match `vendor_message_id` to dispatch; upgrade to DELIVERED or FAILED_TERMINAL for hard bounce.",
         ["Async reconciliation path (Req. 6 AC2)", "Webhook at-least-once dedup", "Idempotent DELIVERED upgrade when worker already set DELIVERED"],
         ["INSERT vendor_events ON CONFLICT DO NOTHING", "UPDATE dispatch WHERE status IN ('PROCESSING','DELIVERED') for delivered events", "Hard bounce → FAILED_TERMINAL + failure_code"],
         ["RPC reconcile_vendor_event", "Tests Task 92, 118"],
         ["Task 8", "Task 61"],
         ["Duplicate vendor_event_id → no double state change", "Webhook and worker success paths converge idempotently"],
         ["Duplicate webhook 200 noop", "Unknown vendor_message_id → log warning no dispatch update"],
         ["Audit on status change", "vendor_event_id logged"],
         ["HMAC verified in Edge Task 73 before RPC"],
         ["Index on vendor_message_id if lookup slow — optional"],
         "6", "Req.6 AC2"),
]
# fmt: on

# Add remaining tasks from compact spec - merge with generator for 120 total
REMAINING = """
12|Implement BEFORE UPDATE FSM trigger attachment|2|Attach trigger trg_message_dispatches_validate to message_dispatches|11|4|Req.4 AC3
13|Enable RLS on message_dispatches|2|SELECT for owner profile_id only; REVOKE INSERT UPDATE DELETE for authenticated|4|Design §3.8
14|Enable RLS on message_dispatcher_audit|2|SELECT where auth.uid()=profile_id|7|Req.6 AC1
15|Enable RLS on message_dispatch_deliveries|2|SELECT via EXISTS owned dispatch|6|Design §3.8
16|Enable RLS on message_templates|2|SELECT authenticated; no write|3|Req.2 AC3
17|Seed platform_constants MMD keys|2|email_daily_limit=5 push_daily_limit=20 push_cooldown_minutes=20 lease_seconds=30 max_retries=3 checkout_batch_size=25 backoff_base_seconds=60|1|Req.1 AC1 Req.7 AC3
18|Seed MVP message_templates rows|2|At least welcome email and engagement push with variable_schema|3,17|Req.2 AC1 AC2
19|Create audit indexes dispatch_created profile_created|2|message_dispatcher_audit_dispatch_created_idx and profile_created|7|Req.6 AC3
20|Document immutable fields operator runbook|2|idempotency_key correlation_id template_variables after QUEUED audit append-only|4|Design §2.4
22|Implement ingest duplicate idempotency return|3|SELECT existing by key return duplicate=true no second insert|21|Req.5 AC1
23|Implement ingest FOR UPDATE user_limits|3|Lock ordering limits before dispatches insert|5,21|Req.1 AC3
25|Implement ingest push 24h quota|3|push_count live COUNT >=20 cancel or terminal|23|Req.1 AC1
27|Implement ingest template channel validation|3|Reject unknown template_key inactive template invalid channel|3,18|Req.2 AC3
28|Implement ingest SCHEDULED vs QUEUED branching|3|future scheduled_for SCHEDULED else QUEUED after evaluation|24-27|Req.4 AC1
29|Package message_dispatcher_ingest SECURITY DEFINER|3|search_path message_dispatcher public auth GRANT EXECUTE service_role|21-28|Design §11.1
30|Implement message_dispatcher_cancel cancelable states|3|FOR UPDATE dispatch CANCELED cancel_reason audit|11|Req.4 AC2
31|Implement cancel 409 on PROCESSING DELIVERED|3|RAISE SQLSTATE 40901 or P0001 mapped to HTTP 409|30|Req.4 AC3
32|Grant cancel to authenticated owner|3|auth.uid()=profile_id OR service_role|30,31|Req.4 AC2
33|Implement activate_scheduled cron RPC|4|UPDATE SCHEDULED SET PENDING_EVALUATION where scheduled_for<=now batch 500 SKIP LOCKED|28|Req.4 AC1
34|Implement evaluate_pending subroutine|4|Re-run eligibility to QUEUED or terminal within same cron txn|33|Req.4 AC1
35|Implement promote_retries RPC|4|FAILED_RETRYABLE to QUEUED where next_retry_at<=now|36|Req.7 AC1
36|Implement compute_next_retry_at helper|4|power(2,retry_count)*60 seconds|4|Req.7 AC1
38|Create audit_on_dispatch_update function|4|SECURITY DEFINER insert audit on status scheduled_for locked_until change|7|Req.6 AC1
39|Attach AFTER UPDATE audit trigger|4|trg_message_dispatcher_audit on message_dispatches|38|Req.6 AC1
40|Schedule pg_cron mmd_activate_scheduled|4|* * * * * SELECT message_dispatcher_activate_scheduled()|33|Req.4 AC1
41|Schedule pg_cron mmd_promote_retries|5|* * * * *|35|Req.7 AC1
42|Schedule pg_cron mmd_reclaim_leases|5|* * * * *|37|Req.3 AC3
45|Implement checkout email auth.users resolution|5|SELECT email FROM auth.users WHERE id=profile_id attach recipient_email JSON|44|Design §2.6
46|Implement checkout no_email_on_file terminal|5|FAILED_TERMINAL failure_code skip worker payload|45|Design §2.6
47|Implement checkout push fan-out INSERT deliveries|5|Eligible user_device_beacons push_enabled fcm_token not null|44,6|Req.2 AC2
48|Implement checkout no_push_targets terminal|5|Zero devices FAILED_TERMINAL no_push_targets|47|Design §2.6
49|Implement checkout JSON DTO array response|5|jsonb_agg items with correlation_id deliveries recipient_email|43-48|Req.5 AC3
50|Enforce max 10 devices per dispatch at checkout|5|LIMIT 10 on beacon enumeration configurable platform_constants|47|Design §9.2
51|Grant checkout EXECUTE service_role only|5|REVOKE FROM PUBLIC authenticated|43|Design §11.1
52|Scaffold message-dispatcher-worker Edge|6|Deno supabase/functions/message-dispatcher-worker index.ts shared logger|51|Design §5.5
53|Add worker to config.toml verify_jwt false|6|supabase/config.toml entry|52|Design §5.5
54|Implement worker auth DISPATCHER_CRON_SECRET|6|Validate X-Dispatcher-Secret or Bearer service_role JWT|52|Design §11.6
55|Wire worker checkout_batch call|6|supabase.rpc message_dispatcher_checkout_batch p_limit p_worker_id|54,51|Req.3 AC1
56|Implement worker email Mustache or template render|6|subject_template body_template substitution validate vars size 8KB|18,55|Req.2 AC1
57|Implement worker push JSON Schema validation|6|Validate template_variables against message_templates.variable_schema before FCM|18,55|Req.2 AC2
59|Implement worker FCM HTTP v1 per delivery|6|One request per delivery row fcm_token_snapshot apns-collapse-id correlation_id|57,49|Req.2 AC2 Req.5 AC3
60|Implement worker 25s HTTP timeout|6|AbortController 25000ms lease 30s alignment|55|Req.3 AC2
61|Implement report_delivery_outcome success DELIVERED|7|UPDATE parent vendor_message_id status DELIVERED per-delivery sent|44,51|Req.6 AC2
62|Implement report guards locked_by status|7|WHERE status PROCESSING AND locked_by match OR locked_until>now stale no-op|61|Req.3 AC1
64|Implement report terminal failure path|7|FAILED_TERMINAL failure_reason failure_code clear lease|61|Req.7 AC2
65|Implement report max_retries force terminal|7|IF retry_count>=max_retries terminal regardless of HTTP class|63|Req.7 AC3
66|Implement beacon disable on invalid FCM token|7|UPDATE public.user_device_beacons push_enabled false fcm_token null|64|Req.7 AC2
67|Implement partial push fan-out parent DELIVERED|7|Any delivery sent parent DELIVERED metadata partial_failures jsonb|61|Design §8.4
68|Wire worker HTTP classifier|7|Map status codes to retryable vs terminal before report RPC|63,64|Req.7 AC1 AC2
69|Wire sequential report per dispatch|7|await report after each item avoid unbounded parallel CPU|68|Req.5 AC3
70|Schedule mmd_invoke_worker pg_net POST|7|*/1 * * * * pg_net http_post worker URL Authorization Bearer cron secret interval>=15s|52-69|Design §6.4
71|Scaffold message-dispatcher-webhook-resend|8|Deno handler Resend Svix signature|74|Design §5.6
72|Add webhook config.toml|8|verify_jwt false public URL|71|Design §5.6
73|Implement Resend HMAC verification|8|Reject invalid signature before RPC|71|Design §11.3
75|Implement reconcile duplicate vendor_event noop|8|ON CONFLICT DO NOTHING RETURN 200|74|Req.6 AC2
76|Implement reconcile delivered DELIVERED|8|Idempotent upgrade processing or delivered|74|Req.6 AC2
77|Implement reconcile hard bounce terminal|8|FAILED_TERMINAL failure_code hard_bounce|74|Req.7 AC2
78|Wire webhook to reconcile RPC|8|service_role client after verify|73-77|Req.6 AC2
79|Integrate platform rateLimiter 120 min|8|_shared/rateLimiter.ts on worker entry|52|Design §11.4
80|Implement audit_timeline RPC|8|SELECT ordered audit rows by dispatch_id|38,19|Req.6 AC3
81|Add Sentry spans worker|9|checkout render provider_http report_outcome|52,68|Design §10.3
82|Document mmd metrics catalog|9|ingest_total checkout_latency queue_depth reclaims|37,43|Design §10.2
83|Optional message_dispatcher_stats table|9|Cron scraped gauges for Logflare|82|Design §10.2
84|SQL alerts queue lag terminal spike janitor|9|QUEUED scheduled_for<now()-5m count FAILED_TERMINAL rate|37,35|Design §10.5
85|Dead-letter ops runbook FAILED_TERMINAL|9|Queries by failure_code failure_reason|64|Design §10.6
86|Recovery chain runbook|9|reclaim promote worker manual reclaim|37,35,41|Req.3 AC3
87|Poison message policy doc|9|invalid_token template_render_error hard_bounce no requeue|64,77|Design §8.3
88|Integration test lease orphan recovery|9|PROCESSING past locked_until assert FAILED_RETRYABLE|37,42|Req.3 AC3
89|Integration test 429 retryable backoff|9|Mock HTTP 429 assert next_retry_at|63|Req.7 AC1
90|Integration test FCM bad token terminal|9|Assert beacon disabled|66|Req.7 AC2
91|Integration test max_retries terminal|9|Fourth failure terminal|65|Req.7 AC3
92|Integration test duplicate webhook|9|Same vendor_event_id twice|75|Req.6 AC2
93|Integration test pg_net failure QUEUED persists|9|Worker down rows stay QUEUED|70|Design §8.1
94|Audit RPC SECURITY DEFINER search_path|10|All MMD RPCs set search_path message_dispatcher public auth|29,51,61,74|Design §11.1
95|Revoke authenticated INSERT UPDATE dispatches|10|Explicit REVOKE GRANT hardening|13|Design §3.8
96|service_role only EXECUTE ingest checkout report reconcile|10|REVOKE EXECUTE FROM anon authenticated|29,51,61,74|Design §11.1
97|Enforce template_variables 8KB JSON Schema|10|RPC CHECK octet_length variables <=8192 Edge validate|27,57|Design §11.4
98|Anti-corruption doc template_key only|10|Engineering doc no raw HTML from producers|18|Design §11.5
99|Configure Edge secrets|10|RESEND_API_KEY FCM_SERVICE_ACCOUNT DISPATCHER_CRON_SECRET|54,58,59|Design §11.6
100|Security test duplicate ingest|10|Parallel same idempotency_key single row|22|Req.5 AC1
101|Security test stale report no-op|10|Report after janitor reclaim no status change|62,37|Design §4.10
102|Concurrency test cancel vs checkout|10|Race FOR UPDATE cancel vs SKIP LOCKED|30,43|Req.4 AC3
103|Concurrency test 5 parallel checkout|10|Disjoint id sets count=5 limit=1 each|43|Req.3 AC1
104|Concurrency test parallel ingest quota|10|Two push ingests one slot one success|23,25|Req.1 AC3
105|Load test ingest 50 RPS MVP|11|Soak 5 min sustained service_role ingest|29|Design §9.1
106|EXPLAIN ANALYZE queued poll index|11|Verify Index Scan using queued_poll_idx|9|Design §9.2
107|Tune batch size and wall clock|11|p_limit 25 max 50 worker return under 60s p95|55,60|Design §5.5
108|Cron invoke interval minimum 15s|11|Prevent Edge invocation storm|70|Design §1.6
109|Backpressure playbook|11|FAILED_RETRYABLE depth 10k alert slow source_system|84|Design §9.5
110|Growth stub audit partitioning|11|PARTITION BY RANGE created_at monthly|7,19|Req.6 AC3
111|yarn generate-supabase-types|12|Regenerate Database types for message_dispatcher schema|1-8|§13.1
112|Orbit feature API ingest wrapper|12|src/features/notifications/api service_role ingest RPC|29|Req.5 AC1
113|Orbit cancel hook UI|12|useCancelDispatch message_dispatcher_cancel authenticated|30,32|Req.4 AC2
114|Orbit client idempotency_key UUID v7|12|Generate on every dispatch request|22|Req.5 AC1 AC2
115|Orbit support audit timeline query|12|TanStack query audit_timeline RPC staleTime 30s|14,80|Req.6 AC3
116|E2E email pipeline mock Resend|12|ingest cron worker mock DELIVERED|56,58,61|Req.2 AC1 Req.6 AC1
117|E2E push partial fan-out|12|3 devices 1 bad token parent DELIVERED|67,59|Req.2 AC2
118|E2E Resend webhook reconcile|12|vendor event DELIVERED audit row|78|Req.6 AC2
119|Rollout phase 1 DB RPCs cron no worker|12|mmd_invoke_worker disabled manual verify|40-42|§13.1
120|Rollout phase 2 GA enable worker webhook monitoring|12|Enable pg_net rollback cron.unschedule|70,78,84|Design §8.5
"""

PHASE_NAMES = {
    1: "Phase 1: Database Foundation",
    2: "Phase 2: Persistence Layer",
    3: "Phase 3: Transactional Orchestration",
    4: "Phase 4: Scheduling Engine",
    5: "Phase 5: Distributed Workers (PostgreSQL Queue)",
    6: "Phase 6: APIs & Edge Functions — Worker",
    7: "Phase 7: Eventing & Async Coordination",
    8: "Phase 8: Observability & Auditability",
    9: "Phase 9: Recovery & Reliability",
    10: "Phase 10: Security & Isolation",
    11: "Phase 11: Scalability & Optimization",
    12: "Phase 12: Verification & Rollout",
}

# Parse REMAINING into additional tasks
existing_nums = {t["n"] for t in TASKS}
for line in REMAINING.strip().split("\n"):
    if not line.strip():
        continue
    parts = line.split("|")
    n = int(parts[0])
    if n in existing_nums:
        continue
    title, phase, desc, deps, reqs_acs = parts[1], int(parts[2]), parts[3], parts[4], parts[5]
    dep_list = [f"Task {d.strip()}" for d in deps.replace("-", ",").split(",") if d.strip()]
    acs = reqs_acs if "Req." in reqs_acs or "Design" in reqs_acs or "§" in reqs_acs else f"Req.{reqs_acs}" if reqs_acs.replace(".", "").isdigit() else reqs_acs
    reqs = reqs_acs.split()[0].replace("Req.", "") if reqs_acs.startswith("Req.") else ("Design" if "Design" in reqs_acs else reqs_acs.split(",")[0].strip())
    TASKS.append(task(
        n, title, phase,
        f"{desc}. Implement per design.md and requirements.md operational constraints.",
        [f"Deliver {title} as specified in design document"],
        [
            "Isolation level: READ COMMITTED (PostgreSQL default)",
            "Row-level locking per design §7.2 where concurrent safety required",
            "SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads",
            desc,
        ],
        [
            "SQL migration and/or Edge TypeScript in supabase/functions/",
            "Automated test proving acceptance criteria",
        ],
        dep_list,
        [
            "ACID for all FSM mutations inside RPC transactions",
            "Idempotency via UNIQUE constraints and completion guards where applicable",
            "Edge layer stateless — no retry state in memory",
        ],
        [
            "Transient: FAILED_RETRYABLE + exponential next_retry_at",
            "Orphan PROCESSING: message_dispatcher_reclaim_leases",
            "Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP",
        ],
        [
            "correlation_id on all dispatch-scoped logs",
            "message_dispatcher_audit append on status change",
        ],
        [
            "RLS owner isolation on user-visible tables",
            "service_role for checkout report ingest reconcile",
        ],
        [
            "Partial indexes on queue statuses",
            "Bounded LIMIT on batch RPCs",
        ],
        reqs if isinstance(reqs, str) else str(reqs),
        acs,
    ))

TASKS.sort(key=lambda t: t["n"])
assert len(TASKS) == 120, f"Expected 120 tasks, got {len(TASKS)}"


def fmt_task(t: dict) -> str:
    lines = [f"## {t['n']}. [ ] {t['title']}", "", "Description:", t["desc"], "", "Responsibilities:"]
    for r in t["resp"]:
        lines.append(f"- {r}")
    lines += ["", "Implementation Details:"]
    for i in t["impl"]:
        lines.append(f"- {i}")
    lines += ["", "Deliverables:"]
    for d in t["deliv"]:
        lines.append(f"- {d}")
    lines += ["", "Dependencies:"]
    for d in t["deps"]:
        lines.append(f"- {d}")
    lines += ["", "Runtime Guarantees:"]
    for r in t["runtime"]:
        lines.append(f"- {r}")
    lines += ["", "Failure Handling:"]
    for f in t["failure"]:
        lines.append(f"- {f}")
    lines += ["", "Observability:"]
    for o in t["obs"]:
        lines.append(f"- {o}")
    lines += ["", "Security Considerations:"]
    for s in t["sec"]:
        lines.append(f"- {s}")
    lines += ["", "Performance Considerations:"]
    for p in t["perf"]:
        lines.append(f"- {p}")
    lines += [
        "",
        "Requirements covered:",
        t["reqs"],
        "",
        "Acceptance Criteria covered:",
        t["acs"],
        "",
    ]
    return "\n".join(lines)


def main():
    body = EXEC_STRATEGY
    current_phase = 0
    for t in TASKS:
        if t["phase"] != current_phase:
            current_phase = t["phase"]
            body += f"\n# {PHASE_NAMES[current_phase]}\n\n"
        body += fmt_task(t)
    body += """
---

## Appendix A: Migration file checklist

| Order | File | Tasks |
|-------|------|-------|
| 1 | `20260621100000_create_message_dispatcher_schema_enums_tables.sql` | 1–10, 13–19 |
| 2 | `20260621100100_create_message_dispatcher_fsm_functions.sql` | 11–12, 21–37, 43–51, 61–67, 74–80 |
| 3 | `20260621100200_create_message_dispatcher_audit_triggers.sql` | 38–39 |
| 4 | `20260621100300_create_message_dispatcher_cron_jobs.sql` | 40–42, 70 |

## Appendix B: RPC catalog

| RPC | Tasks |
|-----|-------|
| `message_dispatcher_ingest` | 21–29 |
| `message_dispatcher_cancel` | 30–32 |
| `message_dispatcher_activate_scheduled` | 33–34, 40 |
| `message_dispatcher_promote_retries` | 35, 41 |
| `message_dispatcher_reclaim_leases` | 37, 42 |
| `message_dispatcher_checkout_batch` | 43–51 |
| `message_dispatcher_report_delivery_outcome` | 61–67 |
| `message_dispatcher_reconcile_vendor_event` | 74–78 |
| `message_dispatcher_audit_timeline` | 80 |

## Appendix C: Edge functions

| Function | Tasks |
|----------|-------|
| `message-dispatcher-worker` | 52–60, 55–59, 68–69, 79, 81 |
| `message-dispatcher-webhook-resend` | 71–73, 78 |

## Appendix D: Requirement traceability

| Requirement | Tasks |
|-------------|-------|
| Req. 1 Rate limiting | 5, 17, 23–26, 104 |
| Req. 2 Templates | 3, 18, 27, 56–57, 116–117 |
| Req. 3 Multi-worker | 9, 37, 43–44, 55, 88, 103 |
| Req. 4 Scheduling/Cancel | 28, 30–34, 40, 113, 102 |
| Req. 5 Idempotency | 4, 21–22, 49, 58–59, 100, 114 |
| Req. 6 Observability | 7–8, 19, 38–39, 74–80, 115, 118 |
| Req. 7 Failover/Backoff | 35–37, 63–65, 66, 68, 89–91 |

**Document version:** 1.0.0  
**Last updated:** 2026-05-21  
**Sources:** `requirements.md`, `design.md`
"""
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(body)
    print(f"Wrote {OUT}: {len(TASKS)} tasks, {len(body)} chars")


if __name__ == "__main__":
    main()
