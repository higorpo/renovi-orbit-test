# Implementation Tasks - Multichannel Message Dispatcher (MMD)

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
| W5b | Phase 12a: unit tests + **80% coverage gate** (Tasks 121–125) | Blocks merge of MMD code |
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

### Mandatory quality gate — unit test coverage (80%)

**Policy (applies to every implementation task in this document):** All source code produced to complete Tasks **1–120** MUST ship with **automated unit tests** and MUST meet **≥ 80% coverage on every coverage dimension** before the task is considered done. No exceptions for “small” modules.

| Coverage metric | Minimum | Tooling (Orbit stack) |
|-----------------|---------|------------------------|
| **Statements** | **80%** | Vitest + `@vitest/coverage-v8` (`statements` in v8 report) |
| **Branches** | **80%** | Same (`branches`) |
| **Functions** | **80%** | Same (`functions`) |
| **Lines** | **80%** | Same (`lines`) |

**In-scope artifacts (all paths introduced by MMD tasks):**

| Layer | Paths (representative) | Test runner |
|-------|------------------------|-------------|
| Edge Functions | `supabase/functions/message-dispatcher-worker/**`, `supabase/functions/message-dispatcher-webhook-resend/**` (exclude `index.ts` barrel if re-export only) | Vitest (Deno-compatible) or project-standard Edge test harness |
| Orbit feature / client | `src/features/**/message-dispatcher/**`, `src/features/**/api/*dispatch*`, hooks/wrappers from Tasks 112–115 | `yarn test:run` (Vitest) |
| Shared MMD TS | Any `src/**` or `supabase/functions/_shared/**` modules created solely for MMD | Vitest |
| PL/pgSQL | RPCs, triggers, FSM helpers in `supabase/migrations/*message_dispatcher*` | pgTAP / `supabase test db` or SQL integration suite; **every `IF`/`CASE`/exception branch** MUST have at least one test (branch coverage via scenario matrix when line coverage tools are unavailable) |

**CI enforcement (hard gate):**

- A dedicated CI step (Task **125**) MUST run coverage with **thresholds configured to 80** for `statements`, `branches`, `functions`, and `lines`.
- Pull requests that add or modify MMD code MUST **fail** if any metric falls below 80% for the **MMD coverage scope** (see Task **121**).
- Coverage reports MUST be generated in CI (`text-summary` minimum; HTML artifact recommended).

**Definition of Done (per implementation task):**

1. Production code merged for the task scope.
2. Unit tests colocated (`__tests__/*.test.ts` or `*.test.sql`) covering happy path, error paths, and concurrency-relevant branches.
3. Coverage report shows **≥ 80%** on statements, branches, functions, and lines for files touched by the task.
4. No decrease of global MMD module coverage below 80% after merge.

**Relationship to integration/E2E tasks (88–118):** Integration and E2E tests are **additive**; they do **not** replace unit tests or the 80% unit coverage gate.

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


# Phase 1: Database Foundation

## 1. [x] Create schema `message_dispatcher` and default privileges

Description:
Execute `CREATE SCHEMA IF NOT EXISTS message_dispatcher` as the first statement in migration `20260621100000`. Configure default privileges and grants so MMD-owned objects are isolated from `public` domain tables while allowing controlled read paths for `authenticated` and full RPC access for `service_role`.

Responsibilities:
- Establish namespace boundary for extraction and grant governance
- Prevent accidental `public` DDL on dispatcher objects
- Document Supabase PostgREST schema exposure

Implementation Details:
- `CREATE SCHEMA IF NOT EXISTS message_dispatcher`
- REVOKE ALL ON SCHEMA message_dispatcher FROM PUBLIC; GRANT USAGE TO service_role, authenticated
- ALTER DEFAULT PRIVILEGES IN SCHEMA message_dispatcher GRANT SELECT ON TABLES TO authenticated
- Comment block referencing design §2.0 API exposure checklist

Deliverables:
- Migration `20260621100000` header block
- Schema creation SQL
- Grant matrix in migration README comment

Dependencies:
- None — W0 entry gate

Runtime Guarantees:
- Schema existence is hard prerequisite for all subsequent MMD migrations

Failure Handling:
- Idempotent `IF NOT EXISTS` for re-run safety on branched environments

Observability:
- N/A

Security Considerations:
- No client writes without explicit GRANT; service_role owns mutations via RPC

Performance Considerations:
- N/A

Requirements covered:
Design §2.0

Acceptance Criteria covered:
—
## 2. [x] Create enums `message_channel`, `message_dispatch_status`, `message_delivery_outcome`

Description:
Define PostgreSQL ENUM types in schema `message_dispatcher` per design §3.1. `message_channel` MUST contain only `email` and `push` — this is the primary gate rejecting SMS and unconfigured channels at persistence boundary (Req. 2 AC3).

Responsibilities:
- Encode allowed channels at type level
- Encode eight-state parent FSM
- Encode per-delivery child outcomes for push fan-out

Implementation Details:
- `CREATE TYPE message_dispatcher.message_channel AS ENUM ('email','push')`
- `message_dispatch_status`: PENDING_EVALUATION, SCHEDULED, CANCELED, QUEUED, PROCESSING, DELIVERED, FAILED_RETRYABLE, FAILED_TERMINAL
- `message_delivery_outcome`: pending, sent, failed_retryable, failed_terminal

Deliverables:
- Three ENUM definitions in migration #1
- Type comments documenting terminal vs transient states

Dependencies:
- Task 1

Runtime Guarantees:
- Enum values immutable without forward migration
- Channel rejection occurs before Edge CPU spend

Failure Handling:
- Adding enum value requires `ALTER TYPE ... ADD VALUE` migration with deploy ordering

Observability:
- N/A

Security Considerations:
- Channel allowlist is first anti-abuse boundary

Performance Considerations:
- Enum comparison avoids text CHECK overhead on hot paths

Requirements covered:
2

Acceptance Criteria covered:
Req.2 AC3
## 3. [x] Create table `message_templates`

Description:
Create registry table `message_dispatcher.message_templates` with composite PRIMARY KEY `(template_key, channel)`, `variable_schema jsonb` (JSON Schema subset), `subject_template`, `body_template`, and `active boolean`. This table is the authority for ingest-time template validation.

Responsibilities:
- Store renderable template metadata
- Support composite FK from `message_dispatches`
- Reject inactive templates at ingest without Edge invocation

Implementation Details:
- DDL per design §3.2 including `variable_schema NOT NULL DEFAULT '{}'`
- COMMENT ON TABLE documenting inactive template rejection
- No RLS write for authenticated — ops seed via migration

Deliverables:
- `message_templates` DDL in migration #1
- Composite PK constraint

Dependencies:
- Task 2

Runtime Guarantees:
- Template registry is read-mostly; read committed sufficient

Failure Handling:
- Missing template causes ingest rejection — no dispatch row or FAILED row per product choice (design: reject at evaluation)

Observability:
- N/A

Security Considerations:
- Templates readable by authenticated; mutations only service_role/migrations

Performance Considerations:
- Small cardinality table; no partial index required MVP

Requirements covered:
2

Acceptance Criteria covered:
Req.2 AC1, Req.2 AC3
## 4. [x] Create table `message_dispatches` (FSM authority)

Description:
Create canonical dispatch table with FSM columns: `idempotency_key UUID NOT NULL UNIQUE`, `profile_id` FK→`public.profiles`, `channel`, `template_key`, `template_variables jsonb`, `status` default `PENDING_EVALUATION`, `scheduled_for`, `locked_until`, `locked_by`, `retry_count`, `max_retries`, `next_retry_at`, `correlation_id`, `vendor_message_id`, `failure_code`, `failure_reason`, `metadata`.

Responsibilities:
- Persist Write-Ahead dispatch intent (Operational Architecture)
- Enforce idempotency UNIQUE constraint
- Foreign key to `message_templates(template_key, channel)`

Implementation Details:
- Full DDL design §3.3 including CHECK `retry_count >= 0` and `max_retries > 0`
- `correlation_id UUID NOT NULL DEFAULT gen_random_uuid()` for provider dedup
- `updated_at` column for trigger freshness
- Do NOT store recipient email or fcm_token on parent — resolved at checkout §2.6

Deliverables:
- `message_dispatches` DDL
- UNIQUE constraint on `idempotency_key`
- FK to message_templates

Dependencies:
- Task 2
- Task 3

Runtime Guarantees:
- `idempotency_key` provides exactly-once business dispatch creation
- Recipient addresses resolved at checkout — not on parent row

Failure Handling:
- Duplicate idempotency_key INSERT fails UNIQUE — mapped to return-existing in ingest RPC

Observability:
- correlation_id in all logs

Security Considerations:
- No direct authenticated UPDATE on status — RPC only

Performance Considerations:
- Parent row is hot — partial indexes added in Task 9

Requirements covered:
5

Acceptance Criteria covered:
Req.5 AC1
## 5. [x] Create table `message_dispatcher_user_limits`

Description:
Create per-profile serialization anchor `message_dispatcher_user_limits` with `email_count_24h`, `push_count_24h`, rolling `email_window_start`, `push_window_start`, `last_push_sent_at` for cooldown evaluation.

Responsibilities:
- Serialize concurrent ingest for same profile (Req. 1 AC3)
- Maintain rolling 24h window metadata
- Anchor row for `SELECT ... FOR UPDATE`

Implementation Details:
- PK `profile_id` FK→`public.profiles ON DELETE CASCADE`
- Design §3.4 column set
- Upsert-on-first-ingest pattern documented for RPC

Deliverables:
- `message_dispatcher_user_limits` DDL

Dependencies:
- Task 4

Runtime Guarantees:
- One limits row per profile — lock serializes all channel ingests for profile

Failure Handling:
- Lock hold time MUST remain short — ingest txn only

Observability:
- N/A

Security Considerations:
- Row keyed by profile_id — tenant isolation via profile ownership

Performance Considerations:
- Single-row lock per profile — acceptable at MVP ingest RPS

Requirements covered:
1

Acceptance Criteria covered:
Req.1 AC3
## 6. [x] Create table `message_dispatch_deliveries`

Description:
Create child fan-out table for push with `dispatch_id`, `device_id`, `fcm_token_snapshot`, `outcome`, `vendor_error_code`, `vendor_response jsonb`, `attempt_no`, UNIQUE `(dispatch_id, device_id, attempt_no)`.

Responsibilities:
- Snapshot FCM tokens at checkout for retry-stable I/O
- Track per-device outcomes for partial fan-out
- Support idempotent completion per delivery row

Implementation Details:
- DDL design §3.5
- UNIQUE (dispatch_id, device_id, attempt_no)
- ON DELETE CASCADE from parent dispatch

Deliverables:
- `message_dispatch_deliveries` DDL

Dependencies:
- Task 4

Runtime Guarantees:
- `fcm_token_snapshot` immutable after checkout — Edge MUST NOT re-read live beacons during send

Failure Handling:
- Orphan delivery rows cascade-delete with parent

Observability:
- Per-delivery outcome in report RPC

Security Considerations:
- RLS SELECT via dispatch owner join (Task 15)

Performance Considerations:
- Fan-out capped at checkout (Task 50)

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC1
## 7. [x] Create table `message_dispatcher_audit`

Description:
Create append-only audit table `message_dispatcher_audit` with `bigserial id`, `dispatch_id`, `profile_id`, `old_status`, `new_status`, `changed_by`, `correlation_id`, `delta jsonb`, `created_at`.

Responsibilities:
- Immutable transition history for Req. 6
- Support sub-second support queries via composite indexes
- Growth-phase partitioning attachment point

Implementation Details:
- DDL design §3.6
- No UPDATE/DELETE grants for any role
- Indexes deferred to Task 19

Deliverables:
- `message_dispatcher_audit` DDL

Dependencies:
- Task 4

Runtime Guarantees:
- Audit INSERT occurs in same transaction as parent UPDATE via trigger

Failure Handling:
- If trigger disabled — halt workers per design §8.5 recovery

Observability:
- Support timeline RPC uses dispatch_id index

Security Considerations:
- Owner SELECT via profile_id RLS

Performance Considerations:
- Monthly partitioning stub Task 110

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC1
## 8. [x] Create table `message_dispatcher_vendor_events`

Description:
Create webhook ingress log with `vendor_event_id TEXT PRIMARY KEY`, `dispatch_id`, `vendor`, `event_type`, `payload jsonb`, `processed_at` for at-least-once webhook deduplication.

Responsibilities:
- Dedup Resend webhook replays (Concurrency Req. 7)
- Forensic payload retention
- Idempotent reconcile entry point

Implementation Details:
- DDL design §3.7 with CHECK vendor IN ('resend','fcm')
- INSERT-only policy

Deliverables:
- `message_dispatcher_vendor_events` DDL

Dependencies:
- Task 4

Runtime Guarantees:
- UNIQUE vendor_event_id → second webhook is 200 noop

Failure Handling:
- Duplicate INSERT ON CONFLICT DO NOTHING in reconcile RPC

Observability:
- vendor_event_id in webhook logs

Security Considerations:
- Webhook signature verified in Edge before RPC

Performance Considerations:
- Append-only growth — archive policy ops-defined

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC2
## 9. [x] Create partial indexes on `message_dispatches`

Description:
Create five partial indexes: `queued_poll` (status=QUEUED), `scheduled_due` (SCHEDULED), `retry_due` (FAILED_RETRYABLE), `stale_lease` (PROCESSING), `profile_channel_created` for support analytics.

Responsibilities:
- Enable index-only worker poll without full table scan
- Bound janitor query to PROCESSING+expired lease
- Support Req. 6 AC3 query performance

Implementation Details:
- Exact DDL from design §3.3.2 — note column order `(scheduled_for, created_at)` on queued index
- Run EXPLAIN in Task 106 to verify index usage
- Avoid redundant indexes on idempotency_key (UNIQUE already indexed)

Deliverables:
- Five `CREATE INDEX ... WHERE status = ...` statements

Dependencies:
- Task 4

Runtime Guarantees:
- Checkout SCAN MUST use `message_dispatches_queued_poll_idx` at scale

Failure Handling:
- Reindex CONCURRENTLY if adding indexes to production with traffic

Observability:
- Queue depth gauge queries use partial predicates

Security Considerations:
- N/A

Performance Considerations:
- Hot QUEUED partition mitigation — ORDER BY + LIMIT in checkout

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC1, Req.6 AC3
## 10. [x] Register `message_dispatcher` in Supabase API schema list

Description:
Configure Supabase project to expose schema `message_dispatcher` to PostgREST (or document thin `public` wrapper RPCs if schema list restricted). Publish engineering rule: features MUST call RPCs by name — never direct table INSERT/UPDATE on `message_dispatches.status`.

Responsibilities:
- Enable REST RPC invocation for Orbit producers
- Document forbidden direct client mutations
- Align with feature-based API layer in Orbit

Implementation Details:
- Update `supabase/config.toml` or dashboard schema settings
- Add ADR note in migration comment
- Verify `rpc/message_dispatcher_ingest` reachable from CI smoke test

Deliverables:
- Config change PR
- Developer guideline snippet in migration header

Dependencies:
- Task 1

Runtime Guarantees:
- RPC-only writes preserve FSM integrity

Failure Handling:
- Misconfigured schema exposure blocks integration tests — fail fast in CI

Observability:
- N/A

Security Considerations:
- Reduces attack surface — no broad table GRANT to authenticated

Performance Considerations:
- N/A

Requirements covered:
Design §2.0

Acceptance Criteria covered:
—

# Phase 2: Persistence Layer

## 11. [x] Implement `message_dispatch_status_allowed(from, to)` FSM matrix

Description:
Implement SQL function returning boolean for legal transitions per design §4.8 matrix. Include special case: `PROCESSING→QUEUED` allowed only for janitor/reclaim path (document in function comment). Terminal states `DELIVERED`, `CANCELED`, `FAILED_TERMINAL` have no outbound edges.

Responsibilities:
- Centralize FSM rules for trigger and RPC assertions
- Prevent illegal cancel/checkout completion paths
- Map to SQLSTATE P0001 for API 409 mapping

Implementation Details:
- PL/pgSQL or SQL immutable function in schema message_dispatcher
- Cover all ✓ cells in design transition table §4.8
- Unit test matrix: iterate all pairs assert allowed/blocked

Deliverables:
- Function `message_dispatch_status_allowed`
- pgTAP or SQL test file `fsm_matrix_test.sql`

Dependencies:
- Task 4

Runtime Guarantees:
- Deterministic transition validation on every UPDATE

Failure Handling:
- Illegal transition raises exception — txn rollback, no partial audit

Observability:
- N/A

Security Considerations:
- FSM guard is authoritative — Edge cannot bypass

Performance Considerations:
- O(1) enum comparison per transition check

Requirements covered:
4

Acceptance Criteria covered:
Req.4 AC3
## 12. [x] Implement `message_dispatches_validate_transition()` BEFORE UPDATE trigger

Description:
Attach BEFORE UPDATE trigger on `message_dispatches` invoking `message_dispatch_status_allowed(old.status, new.status)` when `status` changes; raise `invalid status transition` with ERRCODE P0001.

Responsibilities:
- Enforce FSM at row level even if RPC has bug
- Protect against accidental service_role direct UPDATE
- Complement RPC-level guards

Implementation Details:
- Trigger function design §3.3.1
- `CREATE TRIGGER` on message_dispatches
- Test illegal PROCESSING→DELIVERED skip (must fail)

Deliverables:
- Trigger function + TRIGGER attachment in migration #2

Dependencies:
- Task 11

Runtime Guarantees:
- Every status mutation validated — atomic with UPDATE

Failure Handling:
- Rollback entire UPDATE on illegal transition — no audit row for failed transition

Observability:
- Failed transition attempts should log at RPC layer

Security Considerations:
- Defense in depth with completion RPC WHERE clauses

Performance Considerations:
- Negligible overhead vs network I/O

Requirements covered:
4

Acceptance Criteria covered:
Req.4 AC3
## 13. [x] Enable RLS on message_dispatches

Description:
SELECT for owner profile_id only; REVOKE INSERT UPDATE DELETE for authenticated. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Enable RLS on message_dispatches as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- SELECT for owner profile_id only; REVOKE INSERT UPDATE DELETE for authenticated

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 4

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §3.8
## 14. [x] Enable RLS on message_dispatcher_audit

Description:
SELECT where auth.uid()=profile_id. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Enable RLS on message_dispatcher_audit as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- SELECT where auth.uid()=profile_id

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 7

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC1
## 15. [x] Enable RLS on message_dispatch_deliveries

Description:
SELECT via EXISTS owned dispatch. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Enable RLS on message_dispatch_deliveries as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- SELECT via EXISTS owned dispatch

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 6

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §3.8
## 16. [x] Enable RLS on message_templates

Description:
SELECT authenticated; no write. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Enable RLS on message_templates as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- SELECT authenticated; no write

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 3

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
2

Acceptance Criteria covered:
Req.2 AC3
## 17. [x] Seed platform_constants MMD keys

Description:
email_daily_limit=5 push_daily_limit=20 push_cooldown_minutes=20 lease_seconds=30 max_retries=3 checkout_batch_size=25 backoff_base_seconds=60. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Seed platform_constants MMD keys as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- email_daily_limit=5 push_daily_limit=20 push_cooldown_minutes=20 lease_seconds=30 max_retries=3 checkout_batch_size=25 backoff_base_seconds=60

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 1

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
1

Acceptance Criteria covered:
Req.1 AC1 Req.7 AC3
## 18. [x] Seed MVP message_templates rows

Description:
At least welcome email and engagement push with variable_schema. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Seed MVP message_templates rows as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- At least welcome email and engagement push with variable_schema

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 3
- Task 17

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
2

Acceptance Criteria covered:
Req.2 AC1 AC2
## 19. [x] Create audit indexes dispatch_created profile_created

Description:
message_dispatcher_audit_dispatch_created_idx and profile_created. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Create audit indexes dispatch_created profile_created as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- message_dispatcher_audit_dispatch_created_idx and profile_created

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 7

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC3
## 20. [x] Document immutable fields operator runbook

Description:
idempotency_key correlation_id template_variables after QUEUED audit append-only. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Document immutable fields operator runbook as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- idempotency_key correlation_id template_variables after QUEUED audit append-only

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 4

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §2.4

# Phase 3: Transactional Orchestration

## 21. [x] Implement ingest: reject NULL `p_idempotency_key`

Description:
At start of `message_dispatcher_ingest`, validate `p_idempotency_key IS NOT NULL`; raise exception mapped to HTTP 400 without INSERT (Req. 5 AC2).

Responsibilities:
- Mandatory idempotency protocol enforcement
- Fail fast before acquiring user_limits lock
- Clear integrator contract

Implementation Details:
- `IF p_idempotency_key IS NULL THEN RAISE EXCEPTION ... USING ERRCODE '22023'`
- PostgREST maps to 400
- No side effects on NULL key path

Deliverables:
- Branch in `message_dispatcher_ingest` migration #2
- API test: missing key → 400

Dependencies:
- Task 4
- Task 5

Runtime Guarantees:
- No row created — deterministic rejection

Failure Handling:
- Client MUST retry with new key only for new intent — same key on 400 N/A

Observability:
- Counter `mmd_ingest_rejected_total{reason=missing_idempotency}`

Security Considerations:
- Prevents anonymous replay floods

Performance Considerations:
- Avoids useless lock on user_limits

Requirements covered:
5

Acceptance Criteria covered:
Req.5 AC2
## 22. [x] Implement ingest duplicate idempotency return

Description:
SELECT existing by key return duplicate=true no second insert. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement ingest duplicate idempotency return as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- SELECT existing by key return duplicate=true no second insert

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 21

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
5

Acceptance Criteria covered:
Req.5 AC1
## 23. [x] Implement ingest FOR UPDATE user_limits

Description:
Lock ordering limits before dispatches insert. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement ingest FOR UPDATE user_limits as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Lock ordering limits before dispatches insert

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 5
- Task 21

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
1

Acceptance Criteria covered:
Req.1 AC3
## 24. [x] Implement ingest: email 24h quota COUNT → terminal/canceled

Description:
Inside ingest txn after `FOR UPDATE` on user_limits, COUNT `message_dispatches` where `channel='email'` AND `status IN ('DELIVERED','QUEUED','PROCESSING','SCHEDULED')` AND `created_at > now()-interval '24 hours'`. If count >= `email_daily_limit` (default 5), INSERT dispatch with `CANCELED` or `FAILED_TERMINAL` and `metadata.rate_limit` JSON.

Responsibilities:
- Enforce Req. 1 AC1 email cap
- Count in-flight scheduled toward quota
- Log restrictive metadata for support

Implementation Details:
- Use live COUNT not cache-only — counters on user_limits are optimization only per design §3.4
- Read limit from platform_constants
- Set `failure_code='email_daily_quota_exceeded'` when terminal

Deliverables:
- Quota branch in ingest RPC
- Test: 5th email in window blocked

Dependencies:
- Task 23
- Task 17

Runtime Guarantees:
- Quota check atomic with insert under same profile lock
- Parallel ingests cannot exceed cap

Failure Handling:
- No retry — terminal/canceled is final for that dispatch

Observability:
- Audit captures CANCELED transition
- metadata.rate_limit in delta

Security Considerations:
- Quota applies per profile_id

Performance Considerations:
- COUNT uses `profile_channel_created` index

Requirements covered:
1

Acceptance Criteria covered:
Req.1 AC1
## 25. [x] Implement ingest push 24h quota

Description:
push_count live COUNT >=20 cancel or terminal. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement ingest push 24h quota as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- push_count live COUNT >=20 cancel or terminal

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 23

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
1

Acceptance Criteria covered:
Req.1 AC1
## 26. [x] Implement ingest: push 20min cooldown → SCHEDULED reschedule

Description:
When `channel='push'` and `now() < last_push_sent_at + interval '20 minutes'`, INSERT with `status='SCHEDULED'` and `scheduled_for = last_push_sent_at + 20 minutes` (NOT reject) per Req. 1 AC2.

Responsibilities:
- Temporal engagement safety
- Defer rather than drop push intent
- Exclude from QUEUED poll until rescheduled time

Implementation Details:
- Read `last_push_sent_at` from user_limits under lock
- Update scheduled_for on inserted row
- Partial index `scheduled_due` used by activate cron

Deliverables:
- Cooldown branch in ingest
- Test: push at 10:05 after 10:00 send → scheduled_for 10:20

Dependencies:
- Task 23
- Task 25

Runtime Guarantees:
- Cooldown evaluation serialized per profile
- Future SCHEDULED invisible to checkout_batch

Failure Handling:
- N/A — not a failure

Observability:
- Audit shows scheduled_for delta

Security Considerations:
- Per-profile cooldown

Performance Considerations:
- scheduled_due index for cron activation

Requirements covered:
1

Acceptance Criteria covered:
Req.1 AC2
## 27. [x] Implement ingest template channel validation

Description:
Reject unknown template_key inactive template invalid channel. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement ingest template channel validation as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Reject unknown template_key inactive template invalid channel

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 3
- Task 18

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
2

Acceptance Criteria covered:
Req.2 AC3
## 28. [x] Implement ingest SCHEDULED vs QUEUED branching

Description:
future scheduled_for SCHEDULED else QUEUED after evaluation. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement ingest SCHEDULED vs QUEUED branching as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- future scheduled_for SCHEDULED else QUEUED after evaluation

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 24
- Task 27

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
4

Acceptance Criteria covered:
Req.4 AC1
## 29. [x] Package message_dispatcher_ingest SECURITY DEFINER

Description:
search_path message_dispatcher public auth GRANT EXECUTE service_role. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Package message_dispatcher_ingest SECURITY DEFINER as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- search_path message_dispatcher public auth GRANT EXECUTE service_role

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 21
- Task 28

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §11.1
## 30. [x] Implement message_dispatcher_cancel cancelable states

Description:
FOR UPDATE dispatch CANCELED cancel_reason audit. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement message_dispatcher_cancel cancelable states as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- FOR UPDATE dispatch CANCELED cancel_reason audit

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 11

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
4

Acceptance Criteria covered:
Req.4 AC2
## 31. [x] Implement cancel 409 on PROCESSING DELIVERED

Description:
RAISE SQLSTATE 40901 or P0001 mapped to HTTP 409. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement cancel 409 on PROCESSING DELIVERED as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- RAISE SQLSTATE 40901 or P0001 mapped to HTTP 409

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 30

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
4

Acceptance Criteria covered:
Req.4 AC3
## 32. [x] Grant cancel to authenticated owner

Description:
auth.uid()=profile_id OR service_role. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Grant cancel to authenticated owner as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- auth.uid()=profile_id OR service_role

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 30
- Task 31

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
4

Acceptance Criteria covered:
Req.4 AC2

# Phase 4: Scheduling Engine

## 33. [x] Implement activate_scheduled cron RPC

Description:
UPDATE SCHEDULED SET PENDING_EVALUATION where scheduled_for<=now batch 500 SKIP LOCKED. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement activate_scheduled cron RPC as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- UPDATE SCHEDULED SET PENDING_EVALUATION where scheduled_for<=now batch 500 SKIP LOCKED

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 28

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
4

Acceptance Criteria covered:
Req.4 AC1
## 34. [x] Implement evaluate_pending subroutine

Description:
Re-run eligibility to QUEUED or terminal within same cron txn. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement evaluate_pending subroutine as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Re-run eligibility to QUEUED or terminal within same cron txn

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 33

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
4

Acceptance Criteria covered:
Req.4 AC1
## 35. [x] Implement promote_retries RPC

Description:
FAILED_RETRYABLE to QUEUED where next_retry_at<=now. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement promote_retries RPC as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- FAILED_RETRYABLE to QUEUED where next_retry_at<=now

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 36

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC1
## 36. [x] Implement compute_next_retry_at helper

Description:
power(2,retry_count)*60 seconds. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement compute_next_retry_at helper as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- power(2,retry_count)*60 seconds

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 4

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC1
## 37. [x] Implement `message_dispatcher_reclaim_leases` janitor RPC

Description:
Cron-invoked RPC: UPDATE rows `status='PROCESSING' AND locked_until < now()` SET status to `FAILED_RETRYABLE` or `FAILED_TERMINAL` based on `retry_count >= max_retries`, compute `next_retry_at` via backoff helper, clear lease fields, set `failure_code=coalesce(failure_code,'lease_expired')`.

Responsibilities:
- Orphan recovery when Edge dies without report (Req. 3 AC3)
- Bridge at-least-once processing to safe re-queue
- Prevent indefinite PROCESSING staleness

Implementation Details:
- SQL design §4.9 exactly
- Chain with promote_retries in ops runbook
- Do not increment retry_count on lease-only reclaim unless product specifies

Deliverables:
- RPC `message_dispatcher_reclaim_leases`
- pg_cron job Task 42
- Integration test Task 88

Dependencies:
- Task 36
- Task 11

Runtime Guarantees:
- Worst-case zombie visibility: lease 30s + cron 60s granularity
- Reclaimed rows become eligible for retry pipeline

Failure Handling:
- If max_retries exceeded → FAILED_TERMINAL not requeued
- metadata orphan_recoveries optional future

Observability:
- Counter `mmd_lease_reclaims`
- Alert lease_expired >100/min

Security Considerations:
- service_role only

Performance Considerations:
- Uses `message_dispatches_stale_lease_idx`

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC3
## 38. [x] Create audit_on_dispatch_update function

Description:
SECURITY DEFINER insert audit on status scheduled_for locked_until change. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Create audit_on_dispatch_update function as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- SECURITY DEFINER insert audit on status scheduled_for locked_until change

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 7

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC1
## 39. [x] Attach AFTER UPDATE audit trigger

Description:
trg_message_dispatcher_audit on message_dispatches. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Attach AFTER UPDATE audit trigger as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- trg_message_dispatcher_audit on message_dispatches

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 38

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC1
## 40. [x] Schedule pg_cron mmd_activate_scheduled

Description:
* * * * * SELECT message_dispatcher_activate_scheduled(). Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Schedule pg_cron mmd_activate_scheduled as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- * * * * * SELECT message_dispatcher_activate_scheduled()

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 33

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
4

Acceptance Criteria covered:
Req.4 AC1

# Phase 5: Distributed Workers (PostgreSQL Queue)

## 41. [x] Schedule pg_cron mmd_promote_retries

Description:
* * * * *. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Schedule pg_cron mmd_promote_retries as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- * * * * *

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 35

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC1
## 42. [x] Schedule pg_cron mmd_reclaim_leases

Description:
* * * * *. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Schedule pg_cron mmd_reclaim_leases as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- * * * * *

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 37

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC3
## 43. [x] Implement `message_dispatcher_checkout_batch` SKIP LOCKED CTE

Description:
Implement service_role RPC that selects eligible `QUEUED` rows (`scheduled_for <= now()`) using CTE + `FOR UPDATE SKIP LOCKED` + `LIMIT p_limit`, then UPDATE to `PROCESSING` in same transaction.

Responsibilities:
- Exclusive worker claim without blocking peers
- Prevent double checkout under horizontal Edge scaling
- Return empty set when queue drained

Implementation Details:
- Exact SQL core design §4.3 checkout CTE
- Default `p_limit := 25`; reject `p_limit > 50`
- ORDER BY scheduled_for, created_at for fairness

Deliverables:
- RPC `message_dispatcher_checkout_batch`
- Concurrency test Task 103

Dependencies:
- Task 9
- Task 11
- Task 4

Runtime Guarantees:
- At-most-one concurrent owner per row while `locked_until > now()`
- SKIP LOCKED ensures disjoint batches across N workers

Failure Handling:
- Worker crash before report → janitor reclaims (Task 37)
- Empty batch is success — not error

Observability:
- Histogram `mmd_checkout_latency_ms`
- Log batch size and worker_id

Security Considerations:
- service_role EXECUTE only (Task 51)

Performance Considerations:
- MUST use `message_dispatches_queued_poll_idx`

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC1
## 44. [x] Implement checkout atomic lease (`locked_until`, `locked_by`)

Description:
In same transaction as SKIP LOCKED update, set `status='PROCESSING'`, `locked_until=now()+interval '30 seconds'`, `locked_by=p_worker_id`, `updated_at=now()`.

Responsibilities:
- Establish ownership semantics (Operational Architecture)
- Block re-selection until lease expiry
- Align with Edge HTTP timeout 25s (Task 60)

Implementation Details:
- Lease duration from `platform_constants.message_dispatcher.lease_seconds` default 30
- Document optional Phase 2 `extend_lease` not in MVP
- Re-invocation same worker before expiry returns empty for those ids

Deliverables:
- Lease fields set in checkout_batch UPDATE RETURNING

Dependencies:
- Task 43

Runtime Guarantees:
- Atomic lease assignment — no window where row is PROCESSING without locked_until
- At-most-once concurrent processing per dispatch

Failure Handling:
- Lease expiry → reclaim_leases (Task 37)
- Do not renew lease in MVP unless extend_lease added

Observability:
- Metric `mmd_lease_reclaims`
- Alert stale PROCESSING count

Security Considerations:
- locked_by must match on report (Task 62)

Performance Considerations:
- 30s lease >> cron 60s granularity worst-case reclaim delay

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC2
## 45. [x] Implement checkout email auth.users resolution

Description:
SELECT email FROM auth.users WHERE id=profile_id attach recipient_email JSON. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement checkout email auth.users resolution as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- SELECT email FROM auth.users WHERE id=profile_id attach recipient_email JSON

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 44

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §2.6
## 46. [x] Implement checkout no_email_on_file terminal

Description:
FAILED_TERMINAL failure_code skip worker payload. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement checkout no_email_on_file terminal as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- FAILED_TERMINAL failure_code skip worker payload

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 45

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §2.6
## 47. [x] Implement checkout push fan-out INSERT deliveries

Description:
Eligible user_device_beacons push_enabled fcm_token not null. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement checkout push fan-out INSERT deliveries as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Eligible user_device_beacons push_enabled fcm_token not null

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 44
- Task 6

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
2

Acceptance Criteria covered:
Req.2 AC2
## 48. [x] Implement checkout no_push_targets terminal

Description:
Zero devices FAILED_TERMINAL no_push_targets. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement checkout no_push_targets terminal as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Zero devices FAILED_TERMINAL no_push_targets

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 47

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §2.6
## 49. [x] Implement checkout JSON DTO array response

Description:
jsonb_agg items with correlation_id deliveries recipient_email. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement checkout JSON DTO array response as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- jsonb_agg items with correlation_id deliveries recipient_email

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 43
- Task 48

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
5

Acceptance Criteria covered:
Req.5 AC3
## 50. [x] Enforce max 10 devices per dispatch at checkout

Description:
LIMIT 10 on beacon enumeration configurable platform_constants. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Enforce max 10 devices per dispatch at checkout as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- LIMIT 10 on beacon enumeration configurable platform_constants

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 47

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §9.2
## 51. [x] Grant checkout EXECUTE service_role only

Description:
REVOKE FROM PUBLIC authenticated. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Grant checkout EXECUTE service_role only as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- REVOKE FROM PUBLIC authenticated

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 43

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §11.1

# Phase 6: APIs & Edge Functions — Worker

## 52. [x] Scaffold message-dispatcher-worker Edge

Description:
Deno supabase/functions/message-dispatcher-worker index.ts shared logger. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Scaffold message-dispatcher-worker Edge as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Deno supabase/functions/message-dispatcher-worker index.ts shared logger

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 51

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §5.5
## 53. [x] Add worker to config.toml verify_jwt false

Description:
supabase/config.toml entry. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Add worker to config.toml verify_jwt false as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- supabase/config.toml entry

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 52

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §5.5
## 54. [x] Implement worker auth DISPATCHER_CRON_SECRET

Description:
Validate X-Dispatcher-Secret or Bearer service_role JWT. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement worker auth DISPATCHER_CRON_SECRET as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Validate X-Dispatcher-Secret or Bearer service_role JWT

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 52

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §11.6
## 55. [x] Wire worker checkout_batch call

Description:
supabase.rpc message_dispatcher_checkout_batch p_limit p_worker_id. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Wire worker checkout_batch call as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- supabase.rpc message_dispatcher_checkout_batch p_limit p_worker_id

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 54
- Task 51

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC1
## 56. [x] Implement worker email Mustache or template render

Description:
subject_template body_template substitution validate vars size 8KB. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement worker email Mustache or template render as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- subject_template body_template substitution validate vars size 8KB

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 18
- Task 55

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
2

Acceptance Criteria covered:
Req.2 AC1
## 57. [x] Implement worker push JSON Schema validation

Description:
Validate template_variables against message_templates.variable_schema before FCM. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement worker push JSON Schema validation as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Validate template_variables against message_templates.variable_schema before FCM

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 18
- Task 55

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
2

Acceptance Criteria covered:
Req.2 AC2
## 58. [x] Implement worker Resend HTTP with `Idempotency-Key: correlation_id`

Description:
Edge worker sends email via Resend API using **only** `recipient_email` from checkout payload; set header `Idempotency-Key: {correlation_id}`; never accept client-supplied email address.

Responsibilities:
- Provider-side dedup on worker retry (Req. 5 AC3)
- Anti-corruption for recipient resolution
- Synchronous delivery attempt within lease window

Implementation Details:
- RESEND_API_KEY from Edge env
- POST /emails with rendered HTML from Task 56
- Map response vendor id to report RPC

Deliverables:
- `message-dispatcher-worker` Resend module
- Contract test with mock API

Dependencies:
- Task 56
- Task 55
- Task 45

Runtime Guarantees:
- At-least-once Resend semantics mitigated by idempotency header
- Same correlation_id on retry of same dispatch

Failure Handling:
- 429/503 → report retryable (Task 68)
- Hard bounce may arrive via webhook later

Observability:
- Log correlation_id, dispatch_id, http_status
- Sentry span `provider_http`

Security Considerations:
- recipient_email from DB only

Performance Considerations:
- 25s HTTP timeout (Task 60)

Requirements covered:
5

Acceptance Criteria covered:
Req.5 AC3
## 59. [x] Implement worker FCM HTTP v1 per delivery

Description:
One request per delivery row fcm_token_snapshot apns-collapse-id correlation_id. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement worker FCM HTTP v1 per delivery as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- One request per delivery row fcm_token_snapshot apns-collapse-id correlation_id

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 57
- Task 49

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
2

Acceptance Criteria covered:
Req.2 AC2 Req.5 AC3
## 60. [x] Implement worker 25s HTTP timeout

Description:
AbortController 25000ms lease 30s alignment. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement worker 25s HTTP timeout as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- AbortController 25000ms lease 30s alignment

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 55

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC2

# Phase 7: Eventing & Async Coordination

## 61. [x] Implement report_delivery_outcome success DELIVERED

Description:
UPDATE parent vendor_message_id status DELIVERED per-delivery sent. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement report_delivery_outcome success DELIVERED as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- UPDATE parent vendor_message_id status DELIVERED per-delivery sent

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 44
- Task 51

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC2
## 62. [x] Implement report guards locked_by status

Description:
WHERE status PROCESSING AND locked_by match OR locked_until>now stale no-op. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement report guards locked_by status as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- WHERE status PROCESSING AND locked_by match OR locked_until>now stale no-op

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 61

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC1
## 63. [x] Implement `report_delivery_outcome` retryable failure path

Description:
On Edge classification retryable (429,502,503,timeout), RPC sets `status='FAILED_RETRYABLE'`, increments `retry_count`, sets `next_retry_at = now() + power(2, retry_count) * interval '60 seconds'` per Req. 7 AC1, clears lease.

Responsibilities:
- Persist backoff in DB — Edge holds no retry state
- Coordinate with promote_retries cron
- Survive Edge cold start

Implementation Details:
- Shared helper `message_dispatcher_compute_next_retry_at(retry_count)`
- Clear locked_until, locked_by on failure
- Store http_status in metadata

Deliverables:
- Retryable branch in report RPC
- Test Task 89

Dependencies:
- Task 36
- Task 61

Runtime Guarantees:
- Backoff monotonic — retry_count only increases
- promote_retries moves to QUEUED when due

Failure Handling:
- After max_retries → Task 65 terminal path
- Provider outage creates retry backlog — monitor depth

Observability:
- Gauge `mmd_retryable_failures`
- Histogram time-to-promote

Security Considerations:
- service_role only

Performance Considerations:
- Batch promote 500 rows SKIP LOCKED at cron

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC1
## 64. [x] Implement report terminal failure path

Description:
FAILED_TERMINAL failure_reason failure_code clear lease. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement report terminal failure path as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- FAILED_TERMINAL failure_reason failure_code clear lease

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 61

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC2
## 65. [x] Implement report max_retries force terminal

Description:
IF retry_count>=max_retries terminal regardless of HTTP class. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement report max_retries force terminal as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- IF retry_count>=max_retries terminal regardless of HTTP class

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 63

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC3
## 66. [x] Implement beacon disable on invalid FCM token

Description:
UPDATE public.user_device_beacons push_enabled false fcm_token null. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement beacon disable on invalid FCM token as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- UPDATE public.user_device_beacons push_enabled false fcm_token null

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 64

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC2
## 67. [x] Implement partial push fan-out parent DELIVERED

Description:
Any delivery sent parent DELIVERED metadata partial_failures jsonb. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement partial push fan-out parent DELIVERED as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Any delivery sent parent DELIVERED metadata partial_failures jsonb

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 61

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §8.4
## 68. [x] Wire worker HTTP classifier

Description:
Map status codes to retryable vs terminal before report RPC. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Wire worker HTTP classifier as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Map status codes to retryable vs terminal before report RPC

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 63
- Task 64

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC1 AC2
## 69. [x] Wire sequential report per dispatch

Description:
await report after each item avoid unbounded parallel CPU. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Wire sequential report per dispatch as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- await report after each item avoid unbounded parallel CPU

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 68

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
5

Acceptance Criteria covered:
Req.5 AC3
## 70. [x] Schedule mmd_invoke_worker pg_net POST

Description:
*/1 * * * * pg_net http_post worker URL Authorization Bearer cron secret interval>=15s. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Schedule mmd_invoke_worker pg_net POST as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- */1 * * * * pg_net http_post worker URL Authorization Bearer cron secret interval>=15s

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 52
- Task 69

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §6.4

# Phase 8: Observability & Auditability

## 71. [x] Scaffold message-dispatcher-webhook-resend

Description:
Deno handler Resend Svix signature. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Scaffold message-dispatcher-webhook-resend as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Deno handler Resend Svix signature

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 8

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §5.6
## 72. [x] Add webhook config.toml

Description:
verify_jwt false public URL. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Add webhook config.toml as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- verify_jwt false public URL

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 71

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §5.6
## 73. [x] Implement Resend HMAC verification

Description:
Reject invalid signature before RPC. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement Resend HMAC verification as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Reject invalid signature before RPC

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 71

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §11.3
## 74. [x] Implement `message_dispatcher_reconcile_vendor_event` RPC

Description:
Service_role RPC: INSERT into `message_dispatcher_vendor_events` with `vendor_event_id`; on conflict return success noop; match `vendor_message_id` to dispatch; upgrade to DELIVERED or FAILED_TERMINAL for hard bounce.

Responsibilities:
- Async reconciliation path (Req. 6 AC2)
- Webhook at-least-once dedup
- Idempotent DELIVERED upgrade when worker already set DELIVERED

Implementation Details:
- INSERT vendor_events ON CONFLICT DO NOTHING
- UPDATE dispatch WHERE status IN ('PROCESSING','DELIVERED') for delivered events
- Hard bounce → FAILED_TERMINAL + failure_code

Deliverables:
- RPC reconcile_vendor_event
- Tests Task 92, 118

Dependencies:
- Task 8
- Task 61

Runtime Guarantees:
- Duplicate vendor_event_id → no double state change
- Webhook and worker success paths converge idempotently

Failure Handling:
- Duplicate webhook 200 noop
- Unknown vendor_message_id → log warning no dispatch update

Observability:
- Audit on status change
- vendor_event_id logged

Security Considerations:
- HMAC verified in Edge Task 73 before RPC

Performance Considerations:
- Index on vendor_message_id if lookup slow — optional

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC2
## 75. [x] Implement reconcile duplicate vendor_event noop

Description:
ON CONFLICT DO NOTHING RETURN 200. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement reconcile duplicate vendor_event noop as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- ON CONFLICT DO NOTHING RETURN 200

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 74

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC2
## 76. [x] Implement reconcile delivered DELIVERED

Description:
Idempotent upgrade processing or delivered. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement reconcile delivered DELIVERED as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Idempotent upgrade processing or delivered

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 74

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC2
## 77. [x] Implement reconcile hard bounce terminal

Description:
FAILED_TERMINAL failure_code hard_bounce. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement reconcile hard bounce terminal as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- FAILED_TERMINAL failure_code hard_bounce

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 74

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC2
## 78. [x] Wire webhook to reconcile RPC

Description:
service_role client after verify. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Wire webhook to reconcile RPC as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- service_role client after verify

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 73
- Task 77

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC2
## 79. [x] Integrate platform rateLimiter 120 min

Description:
_shared/rateLimiter.ts on worker entry. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Integrate platform rateLimiter 120 min as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- _shared/rateLimiter.ts on worker entry

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 52

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §11.4
## 80. [x] Implement audit_timeline RPC

Description:
SELECT ordered audit rows by dispatch_id. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Implement audit_timeline RPC as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- SELECT ordered audit rows by dispatch_id

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 38
- Task 19

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC3

# Phase 9: Recovery & Reliability

## 81. [x] Add Sentry spans worker

Description:
checkout render provider_http report_outcome. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Add Sentry spans worker as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- checkout render provider_http report_outcome

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 52
- Task 68

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §10.3
## 82. [x] Document mmd metrics catalog

Description:
ingest_total checkout_latency queue_depth reclaims. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Document mmd metrics catalog as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- ingest_total checkout_latency queue_depth reclaims

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 37
- Task 43

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §10.2
## 83. [x] Optional message_dispatcher_stats table

Description:
Cron scraped gauges for Logflare. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Optional message_dispatcher_stats table as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Cron scraped gauges for Logflare

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 82

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §10.2
## 84. [x] SQL alerts queue lag terminal spike janitor

Description:
QUEUED scheduled_for<now()-5m count FAILED_TERMINAL rate. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver SQL alerts queue lag terminal spike janitor as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- QUEUED scheduled_for<now()-5m count FAILED_TERMINAL rate

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 37
- Task 35

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §10.5
## 85. [x] Dead-letter ops runbook FAILED_TERMINAL

Description:
Queries by failure_code failure_reason. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Dead-letter ops runbook FAILED_TERMINAL as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Queries by failure_code failure_reason

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 64

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §10.6
## 86. [x] Recovery chain runbook

Description:
reclaim promote worker manual reclaim. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Recovery chain runbook as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- reclaim promote worker manual reclaim

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 37
- Task 35
- Task 41

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC3
## 87. [x] Poison message policy doc

Description:
invalid_token template_render_error hard_bounce no requeue. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Poison message policy doc as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- invalid_token template_render_error hard_bounce no requeue

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 64
- Task 77

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §8.3
## 88. [x] Integration test lease orphan recovery

Description:
PROCESSING past locked_until assert FAILED_RETRYABLE. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Integration test lease orphan recovery as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- PROCESSING past locked_until assert FAILED_RETRYABLE

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 37
- Task 42

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC3
## 89. [x] Integration test 429 retryable backoff

Description:
Mock HTTP 429 assert next_retry_at. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Integration test 429 retryable backoff as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Mock HTTP 429 assert next_retry_at

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 63

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC1
## 90. [x] Integration test FCM bad token terminal

Description:
Assert beacon disabled. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Integration test FCM bad token terminal as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Assert beacon disabled

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 66

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC2
## 91. [x] Integration test max_retries terminal

Description:
Fourth failure terminal. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Integration test max_retries terminal as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Fourth failure terminal

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 65

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
7

Acceptance Criteria covered:
Req.7 AC3
## 92. [x] Integration test duplicate webhook

Description:
Same vendor_event_id twice. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Integration test duplicate webhook as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Same vendor_event_id twice

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 75

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC2
## 93. [x] Integration test pg_net failure QUEUED persists

Description:
Worker down rows stay QUEUED. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Integration test pg_net failure QUEUED persists as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Worker down rows stay QUEUED

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 70

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §8.1

# Phase 10: Security & Isolation

## 94. [x] Audit RPC SECURITY DEFINER search_path

Description:
All MMD RPCs set search_path message_dispatcher public auth. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Audit RPC SECURITY DEFINER search_path as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- All MMD RPCs set search_path message_dispatcher public auth

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 29
- Task 51
- Task 61
- Task 74

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §11.1
## 95. [x] Revoke authenticated INSERT UPDATE dispatches

Description:
Explicit REVOKE GRANT hardening. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Revoke authenticated INSERT UPDATE dispatches as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Explicit REVOKE GRANT hardening

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 13

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §3.8
## 96. [x] service_role only EXECUTE ingest checkout report reconcile

Description:
REVOKE EXECUTE FROM anon authenticated. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver service_role only EXECUTE ingest checkout report reconcile as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- REVOKE EXECUTE FROM anon authenticated

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 29
- Task 51
- Task 61
- Task 74

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §11.1
## 97. [x] Enforce template_variables 8KB JSON Schema

Description:
RPC CHECK octet_length variables <=8192 Edge validate. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Enforce template_variables 8KB JSON Schema as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- RPC CHECK octet_length variables <=8192 Edge validate

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 27
- Task 57

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §11.4
## 98. [x] Anti-corruption doc template_key only

Description:
Engineering doc no raw HTML from producers. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Anti-corruption doc template_key only as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Engineering doc no raw HTML from producers

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 18

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §11.5
## 99. [x] Configure Edge secrets

Description:
RESEND_API_KEY FCM_SERVICE_ACCOUNT DISPATCHER_CRON_SECRET. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Configure Edge secrets as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- RESEND_API_KEY FCM_SERVICE_ACCOUNT DISPATCHER_CRON_SECRET

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 54
- Task 58
- Task 59

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §11.6
## 100. [x] Security test duplicate ingest

Description:
Parallel same idempotency_key single row. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Security test duplicate ingest as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Parallel same idempotency_key single row

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 22

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
5

Acceptance Criteria covered:
Req.5 AC1
## 101. [x] Security test stale report no-op

Description:
Report after janitor reclaim no status change. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Security test stale report no-op as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Report after janitor reclaim no status change

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 62
- Task 37

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §4.10
## 102. [x] Concurrency test cancel vs checkout

Description:
Race FOR UPDATE cancel vs SKIP LOCKED. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Concurrency test cancel vs checkout as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Race FOR UPDATE cancel vs SKIP LOCKED

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 30
- Task 43

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
4

Acceptance Criteria covered:
Req.4 AC3
## 103. [x] Concurrency test 5 parallel checkout

Description:
Disjoint id sets count=5 limit=1 each. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Concurrency test 5 parallel checkout as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Disjoint id sets count=5 limit=1 each

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 43

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
3

Acceptance Criteria covered:
Req.3 AC1
## 104. [x] Concurrency test parallel ingest quota

Description:
Two push ingests one slot one success. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Concurrency test parallel ingest quota as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Two push ingests one slot one success

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 23
- Task 25

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
1

Acceptance Criteria covered:
Req.1 AC3

# Phase 11: Scalability & Optimization

## 105. [x] Load test ingest 50 RPS MVP

Description:
Soak 5 min sustained service_role ingest. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Load test ingest 50 RPS MVP as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Soak 5 min sustained service_role ingest

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 29

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §9.1
## 106. [x] EXPLAIN ANALYZE queued poll index

Description:
Verify Index Scan using queued_poll_idx. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver EXPLAIN ANALYZE queued poll index as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Verify Index Scan using queued_poll_idx

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 9

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §9.2
## 107. [x] Tune batch size and wall clock

Description:
p_limit 25 max 50 worker return under 60s p95. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Tune batch size and wall clock as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- p_limit 25 max 50 worker return under 60s p95

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 55
- Task 60

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §5.5
## 108. [x] Cron invoke interval minimum 15s

Description:
Prevent Edge invocation storm. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Cron invoke interval minimum 15s as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Prevent Edge invocation storm

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 70

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §1.6
## 109. [x] Backpressure playbook

Description:
FAILED_RETRYABLE depth 10k alert slow source_system. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Backpressure playbook as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- FAILED_RETRYABLE depth 10k alert slow source_system

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 84

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §9.5
## 110. [x] Growth stub audit partitioning

Description:
PARTITION BY RANGE created_at monthly. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Growth stub audit partitioning as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- PARTITION BY RANGE created_at monthly

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 7
- Task 19

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC3

# Phase 12: Verification & Rollout

> **Coverage reminder:** Tasks **121–125** define the mandatory **≥ 80%** unit coverage gate (statements, branches, functions, lines) for all MMD code. Tasks **88–118** are integration/E2E and do not satisfy the unit coverage policy alone. Every task **1–120** that produces code MUST include unit tests meeting the gate before marking complete.

# Phase 12a: Unit Test Coverage Gate (80% mandatory)

## 121. [ ] Configure Vitest coverage scope and 80% thresholds for MMD

Description:
Extend Orbit Vitest configuration (`vite.config.ts` or dedicated `vitest.mmd.config.ts`) so all TypeScript/Deno modules introduced by MMD tasks are included in coverage collection, with **hard thresholds of 80** for `statements`, `branches`, `functions`, and `lines`. CI and local `yarn test:run` MUST fail when thresholds are not met.

Responsibilities:
- Define explicit `coverage.include` globs for MMD artifacts
- Set `coverage.thresholds` to 80 for all four metrics
- Exclude only test files, fixtures, and pure re-export barrels

Implementation Details:
- Add globs: `supabase/functions/message-dispatcher-worker/**/*.ts`, `supabase/functions/message-dispatcher-webhook-resend/**/*.ts`, `src/features/**/messageDispatcher*.ts` (and paths created in Tasks 112–115)
- In `vite.config.ts` `test.coverage`: `thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 }` scoped via `coverage.include` to MMD paths (or use Vitest 4 `coverage.thresholds` per-directory if supported)
- Add script `yarn test:mmd:coverage` → `vitest run --coverage --config vitest.mmd.config.ts` (or filtered include)
- Document in `docs/message-dispatcher/tasks.md` cross-link (this file) as source of truth for the 80% policy

Deliverables:
- Updated `vite.config.ts` and/or `vitest.mmd.config.ts`
- `package.json` script `test:mmd:coverage`
- README snippet in `supabase/functions/message-dispatcher-worker/README.md` (how to run coverage locally)

Dependencies:
- Task 52 (worker scaffold)
- Task 71 (webhook scaffold)

Runtime Guarantees:
- Coverage gate is deterministic on CI — same command as local
- Thresholds apply to **all** metrics; one metric at 79% fails the build

Failure Handling:
- If threshold fail: developer adds unit tests until all four metrics ≥ 80%
- No `--coverage.skipFull` or threshold bypass in CI

Observability:
- CI publishes `text-summary` coverage output
- Optional HTML artifact upload for PR review

Security Considerations:
- Test fixtures MUST NOT embed production secrets

Performance Considerations:
- Run MMD coverage job in parallel with main test job; cache `node_modules`

Requirements covered:
All (quality gate)

Acceptance Criteria covered:
All ACs (verification infrastructure)

## 122. [ ] Unit test suite — `message-dispatcher-worker` (≥ 80% all metrics)

Description:
Implement Vitest unit tests for every worker module: auth validation, checkout client, template render (email/push), HTTP classifier (429/503/400/timeout), Resend/FCM client wrappers (mocked), and report RPC client. **Statements, branches, functions, and lines MUST each be ≥ 80%.**

Responsibilities:
- Cover all HTTP classification branches (retryable vs terminal)
- Cover empty checkout batch, single item, multi-delivery push
- Cover auth failure paths (missing secret, invalid JWT)
- Mock provider I/O; no live Resend/FCM in unit tests

Implementation Details:
- Colocate tests under `supabase/functions/message-dispatcher-worker/__tests__/`
- Use `vi.mock` for `fetch`, Supabase RPC client, and template registry reads
- Table-driven tests for classifier: input status → expected `p_success` / retryable flag
- Assert `Idempotency-Key` header uses `correlation_id` from payload
- Run `yarn test:mmd:coverage` before PR; fix gaps until four metrics ≥ 80%

Deliverables:
- `*.test.ts` files covering 80%+ on all metrics (worker package)
- Coverage screenshot or CI log attached to epic PR

Dependencies:
- Task 121
- Tasks 54–60, 68–69

Runtime Guarantees:
- Tests run offline; no Flake from network

Failure Handling:
- Flaky tests forbidden — mock timers for backoff display-only logic

Observability:
- N/A

Security Considerations:
- No real API keys in tests

Performance Considerations:
- Keep suite < 30s total

Requirements covered:
2, 3, 5, 7

Acceptance Criteria covered:
Req.2 AC1–AC2, Req.3 AC1, Req.5 AC3, Req.7 AC1–AC2

## 123. [ ] Unit test suite — `message-dispatcher-webhook-resend` (≥ 80% all metrics)

Description:
Vitest unit tests for webhook handler: HMAC signature verification (valid/invalid/missing), payload parsing, reconcile RPC invocation (mocked), duplicate event noop. **All coverage metrics ≥ 80%.**

Responsibilities:
- 100% branch coverage on signature verification paths
- Cover malformed JSON, unknown event types, missing `vendor_event_id`

Implementation Details:
- `supabase/functions/message-dispatcher-webhook-resend/__tests__/`
- Fixtures from Resend sample payloads (sanitized)
- Mock `reconcile_vendor_event` RPC responses

Deliverables:
- Webhook `*.test.ts` with ≥ 80% statements/branches/functions/lines

Dependencies:
- Task 121
- Tasks 71–73, 78

Runtime Guarantees:
- Unit tests do not hit production DB

Failure Handling:
- Invalid signature → 401 without RPC call (assert mock not called)

Observability:
- N/A

Security Considerations:
- Test vectors for timing-safe compare if implemented

Performance Considerations:
- N/A

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC2

## 124. [ ] Unit/integration SQL tests — PL/pgSQL RPCs and FSM (branch matrix ≥ 80%)

Description:
Create SQL test suite (pgTAP recommended under `supabase/tests/message_dispatcher/`) covering **every RPC and trigger branch**: ingest (quota, cooldown, idempotency, template reject), cancel (409 paths), checkout (SKIP LOCKED, no email, no devices), report (success, retryable, terminal, max_retries, stale worker), reconcile (duplicate vendor_event), activate/promote/reclaim cron RPCs, FSM matrix. Where PG line coverage tooling is unavailable, maintain a **branch checklist** mapping each `IF`/`CASE` to a test name; suite MUST document **≥ 80% branch coverage** via matrix review + `pg_prove` pass.

Responsibilities:
- One test file per RPC minimum
- FSM: test all legal transitions and representative illegal transitions
- Concurrency: two-session tests for ingest quota (Req. 1 AC3) may live here or Task 104

Implementation Details:
- Files: `supabase/tests/message_dispatcher/ingest.test.sql`, `checkout.test.sql`, `report.test.sql`, etc.
- Use `BEGIN; ... ROLLBACK;` fixtures with seed profile/beacon/auth.users test data
- `supabase test db` or CI `pg_prove` step
- Branch matrix spreadsheet or markdown table in `supabase/tests/message_dispatcher/BRANCH_MATRIX.md` signed off when SQL coverage tools cannot emit Istanbul-style reports

Deliverables:
- SQL test files + BRANCH_MATRIX.md
- CI step running SQL tests
- Evidence of ≥ 80% branch coverage (tool output or matrix audit)

Dependencies:
- Task 11, 12
- Tasks 21–37, 43–51, 61–67, 74–80

Runtime Guarantees:
- Tests idempotent; clean rollback per test

Failure Handling:
- Failed SQL test blocks merge same as Vitest threshold

Observability:
- N/A

Security Considerations:
- Tests use test profiles only

Performance Considerations:
- Parallel-safe tests only where isolated with unique idempotency_keys

Requirements covered:
1–7

Acceptance Criteria covered:
All Req. 1–7 ACs (DB layer)

## 125. [ ] CI pipeline — enforce MMD unit coverage ≥ 80% (all metrics)

Description:
Add CI job (GitHub Actions or existing Orbit pipeline) that runs `yarn test:mmd:coverage` and SQL MMD tests on every PR touching `supabase/**/message_dispatcher*`, `supabase/functions/message-dispatcher-*`, or `src/**` MMD wrappers. Job MUST fail if **any** of statements/branches/functions/lines **< 80%** for in-scope files.

Responsibilities:
- Hard gate — no merge without green coverage
- PR comment or summary with four metric percentages
- Run on `pull_request` and `push` to main for affected paths

Implementation Details:
- Path filters: `supabase/migrations/*message_dispatcher*`, `supabase/functions/message-dispatcher-*/**`, `src/features/**/*dispatch*`, `supabase/tests/message_dispatcher/**`
- Steps: `nvm use 24.13`, `yarn install`, `yarn test:mmd:coverage`, `supabase test db` (or pg_prove)
- Upload coverage artifact optional
- Document bypass policy: **no bypass** except explicit architect approval with tech debt ticket

Deliverables:
- `.github/workflows/mmd-coverage.yml` (or equivalent)
- Branch protection rule requiring check

Dependencies:
- Task 121
- Task 122
- Task 123
- Task 124

Runtime Guarantees:
- Same command locally and CI — developers reproduce failures

Failure Handling:
- CI fail → add tests; thresholds MUST NOT be lowered below 80% without ADR

Observability:
- Coverage summary in CI logs

Security Considerations:
- CI secrets for DB tests use ephemeral local Supabase only

Performance Considerations:
- Cache yarn; run only when paths change

Requirements covered:
All

Acceptance Criteria covered:
All (delivery gate)

---

# Phase 12: Verification & Rollout

## 111. [x] yarn generate-supabase-types

Description:
Regenerate Database types for message_dispatcher schema. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver yarn generate-supabase-types as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Regenerate Database types for message_dispatcher schema

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 1
- Task 8

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
§13.1

Acceptance Criteria covered:
§13.1
## 112. [x] Orbit feature API ingest wrapper

Description:
src/features/notifications/api service_role ingest RPC. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Orbit feature API ingest wrapper as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- src/features/notifications/api service_role ingest RPC

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 29

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
5

Acceptance Criteria covered:
Req.5 AC1
## 113. [x] Orbit cancel hook UI

Description:
useCancelDispatch message_dispatcher_cancel authenticated. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Orbit cancel hook UI as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- useCancelDispatch message_dispatcher_cancel authenticated

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 30
- Task 32

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
4

Acceptance Criteria covered:
Req.4 AC2
## 114. [x] Orbit client idempotency_key UUID v7

Description:
Generate on every dispatch request. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Orbit client idempotency_key UUID v7 as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- Generate on every dispatch request

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 22

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
5

Acceptance Criteria covered:
Req.5 AC1 AC2
## 115. [x] Orbit support audit timeline query

Description:
TanStack query audit_timeline RPC staleTime 30s. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver Orbit support audit timeline query as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- TanStack query audit_timeline RPC staleTime 30s

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 14
- Task 80

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC3
## 116. [x] E2E email pipeline mock Resend

Description:
ingest cron worker mock DELIVERED. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver E2E email pipeline mock Resend as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- ingest cron worker mock DELIVERED

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 56
- Task 58
- Task 61

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
2

Acceptance Criteria covered:
Req.2 AC1 Req.6 AC1
## 117. [x] E2E push partial fan-out

Description:
3 devices 1 bad token parent DELIVERED. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver E2E push partial fan-out as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- 3 devices 1 bad token parent DELIVERED

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 67
- Task 59

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
2

Acceptance Criteria covered:
Req.2 AC2
## 118. [x] E2E Resend webhook reconcile

Description:
vendor event DELIVERED audit row. Implement per design.md and requirements.md operational constraints.

Responsibilities:
- Deliver E2E Resend webhook reconcile as specified in design document

Implementation Details:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Row-level locking per design §7.2 where concurrent safety required
- SECURITY DEFINER + search_path = message_dispatcher, public, auth for cross-schema reads
- vendor event DELIVERED audit row

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 78

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
6

Acceptance Criteria covered:
Req.6 AC2

## 119. [x] Rollout phase 1: DB + RPCs + cron (worker disabled)

Description:
Deploy migrations `20260621100000` through `20260621100300` to staging/production. Enable `mmd_activate_scheduled`, `mmd_promote_retries`, and `mmd_reclaim_leases`. **DO NOT** enable `mmd_invoke_worker` / `pg_net`. Validate ingest/cancel via `service_role` smoke tests; manual `checkout_batch(p_limit:=1)` allowed in staging without provider I/O.

Responsibilities:
- Ship authoritative FSM schema without external send side effects
- Prove scheduling and janitor loops on production clock
- Constrain blast radius to PostgreSQL layer

Implementation Details:
- Deploy order per design §13.1: schema → RPCs → audit triggers → cron (excluding worker invoke)
- Smoke: `message_dispatcher_ingest` with `source_system='mmd_smoke_test'` only
- Verify SCHEDULED rows never appear in `checkout_batch` until `scheduled_for <= now()`
- Rollback: `SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE 'mmd_%'` — retain schema and audit

Deliverables:
- Staging/prod migration apply record
- Rollout checklist signed by on-call
- Smoke test run log (ingest, cancel, activate, reclaim)

Dependencies:
- Task 40
- Task 41
- Task 42

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
§13.1

Acceptance Criteria covered:
Design §13.1

## 120. [x] Rollout phase 2: GA — worker, webhook, monitoring, rollback

Description:
Enable `mmd_invoke_worker` (`pg_net` POST every ≥15s), deploy `message-dispatcher-worker` and `message-dispatcher-webhook-resend` with production secrets. Register Resend webhook URL. Open canary ingest for first producer (`matching`). Operate alerts from Task 84 (queue lag, terminal spike, janitor churn). Document rollback: `cron.unschedule('mmd_invoke_worker')` → revoke checkout/report EXECUTE → dispatches remain forensic.

Responsibilities:
- Turn on end-to-end delivery path under monitored SLOs
- Validate reconciliation and dead-letter visibility
- Maintain one-command rollback without data destruction

Implementation Details:
- Pre-GA checklist: Tasks **88–93**, **100**, **103** green; Tasks **121–125** green (**≥ 80%** unit coverage on statements, branches, functions, lines for all MMD code)
- Canary: 1% traffic or `source_system` allowlist for 24h; watch `FAILED_TERMINAL` rate <5%/15m
- Enable Sentry + Logflare dashboards (Task 81–84)
- Resend webhook: verify HMAC in staging before DNS cutover
- Post-GA: run Task 111 `yarn generate-supabase-types`; merge Orbit wrappers (Tasks 112–115)

Deliverables:
- SQL migration and/or Edge TypeScript in supabase/functions/
- Automated test proving acceptance criteria

Dependencies:
- Task 70
- Task 78
- Task 84

Runtime Guarantees:
- ACID for all FSM mutations inside RPC transactions
- Idempotency via UNIQUE constraints and completion guards where applicable
- Edge layer stateless — no retry state in memory

Failure Handling:
- Transient: FAILED_RETRYABLE + exponential next_retry_at
- Orphan PROCESSING: message_dispatcher_reclaim_leases
- Terminal: FAILED_TERMINAL dead-letter — no auto requeue MVP

Observability:
- correlation_id on all dispatch-scoped logs
- message_dispatcher_audit append on status change

Security Considerations:
- RLS owner isolation on user-visible tables
- service_role for checkout report ingest reconcile

Performance Considerations:
- Partial indexes on queue statuses
- Bounded LIMIT on batch RPCs

Requirements covered:
Design

Acceptance Criteria covered:
Design §8.5

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

## Appendix E: Unit test coverage policy (mandatory)

| Rule | Value |
|------|-------|
| Minimum **statements** | **80%** |
| Minimum **branches** | **80%** |
| Minimum **functions** | **80%** |
| Minimum **lines** | **80%** |
| Applies to | All code from Tasks 1–120 |
| Enforcement tasks | **121** (config), **122–124** (suites), **125** (CI gate) |
| Per-task DoD | Unit tests + four metrics ≥ 80% before task complete |
| Integration/E2E (88–118) | Required in addition; does not replace unit coverage |

**Document version:** 1.1.0  
**Last updated:** 2026-05-21  
**Sources:** `requirements.md`, `design.md`
