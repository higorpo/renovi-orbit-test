# Service Completion & Publication Readiness Requirements

> **Document Type:** Architecture Requirements Specification (RFC-style)  
> **Version:** 1.0  
> **Date:** 2026-08-04  
> **Status:** Active  
> **Audience:** Principal Engineers, Staff Engineers, Backend Engineers, Mobile Engineers  
> **Domain glossary:** [`CONTEXT.md`](./CONTEXT.md) · **ADR:** [`ADR-0001`](./adr/0001-separate-enrichment-fsm-for-publication-readiness.md) · [`ADR-0002`](./adr/0002-evidence-images-block-not-image-gallery.md) · [`ADR-0003`](./adr/0003-completion-criterion-block.md)  
> **Related:** Matching [`requirements.md`](../matching-algorithm/requirements.md) · Payment [`payment-system-requirements.md`](../payment-system/payment-system-requirements.md) · Message Dispatcher [`requirements.md`](../message-dispatcher/requirements.md)

---

## Context

### System Purpose

The **Service Completion & Publication Readiness** subsystem owns two coupled but distinct concerns within the Orbit marketplace:

1. **Publication Readiness (pre-matching enrichment)** — After a `service_request` is created, the platform MUST asynchronously materialize a **completion checklist** (Dynamic Form schema) before matching/dispatch may begin. Until enrichment reaches `READY`, the request exists but MUST NOT be visible to providers and MUST NOT bootstrap progressive matching batches.
2. **Service Completion (post-contract execution)** — After a `contracted_service` reaches `CONFIRMED` (payment captured), the contracted provider fills checklist responses and evidence, transitions to `EXECUTED`, and the client confirms delivery (with mandatory rating on the manual path) or the system auto-completes after grace (~24h) into `COMPLETED`, enabling optional post-auto-complete rating.

**Problem Statement.** Today, matching bootstraps on first `service_requests.status = OPEN` insert, and execution marking (legacy `payment_mark_service_executed`; successor `service_completion_mark_executed`) lacks a structured, auditable completion checklist with evidence, late-execution signaling, draft persistence, and atomic confirm+rating. Separately, AI-assisted enrichment (checklist generation) is a different failure domain from matching distribution (retries, leases, LLM timeouts, template fallback). Folding enrichment into `service_request_status` or into matching `DISPATCH_*` conflates negotiation lifecycle with operational readiness ([ADR-0001](./adr/0001-separate-enrichment-fsm-for-publication-readiness.md)).

**Business Objectives:**

- Guarantee every published service request has a materialized completion checklist (AI-generated or template fallback) before providers see it.
- Ensure providers can declare execution with verifiable evidence packages, including justified negative checklist items, without inventing intermediate CS statuses.
- Ensure clients can review evidence and confirm delivery with a mandatory multidimensional rating in one atomic flow; auto-complete MUST NOT block marketplace liquidity on client inaction.
- Keep enrichment, matching delay (5 min), payment charge timing, and execution marking as separate temporal clocks with explicit handoffs.
- Never publish without a checklist; never auto-cancel a service request solely because AI checklist generation failed.

**Technical Objectives:**

- Introduce a durable **enrichment FSM** (`PENDING` → `RUNNING` → `READY`, with retry/fallback paths) as the sole source of truth for publication readiness; `service_requests.status` MUST NOT encode readiness.
- Change matching bootstrap from “first OPEN insert” to “enrichment `READY` handoff,” preserving the existing 5-minute `matching.dispatch_start_delay_minutes` clock **after** readiness.
- Extend (do not replace) `contracted_services` lifecycle `PENDING_PAYMENT | CONFIRMED | EXECUTED | COMPLETED | CANCELLED`. Self-serve writers MUST be `service_completion_mark_executed`, `service_completion_confirm_with_rating`, and `service_completion_auto_complete_executed` (+ cron/`job_runs`). Legacy `payment_mark_service_executed` / `payment_confirm_service_completed` / `payment_cron_auto_complete_*` MUST be removed from the product API ([ADR-0004](./adr/0004-completion-rpcs-outside-payments.md)).
- Reuse Dynamic Form engine with a dedicated `completion_criterion` block; reuse `service_ratings` (quality / punctuality / communication / value, 1–5) and restore authenticated grants on submit/update RPCs as needed.
- Keep `generate-smart-description` as **pre-create sync**; checklist generation is **post-create async enrichment**.
- Route notifications (including existing `SERVICE_EXECUTED` pattern) through Message Dispatcher (MMD) for push + email.
- Reuse job_runs, leases, `SELECT FOR UPDATE SKIP LOCKED`, and pg_cron patterns from matching / payments / MMD.

**Operational Constraints:**

- Enrichment workers MUST be restart-safe, lease-owned, and idempotent.
- Checklist schema MUST be immutable after materialization; negotiation-time schema editing is out of scope.
- Evidence package MUST be immutable after `EXECUTED`.
- Block allowlist for checklist schemas: `completion_criterion`, `static_text` only ([ADR-0003](./adr/0003-completion-criterion-block.md)). Intake `yes_no` / `image_gallery` MUST NOT appear in completion schemas.
- Cardinality: 3–12 `completion_criterion` items (bounds in `platform_constants`); `static_text` does not count.
- Evidence policy: unmet ⇒ ≥1 photo + justification; met ⇒ photos only if `requires_evidence_when_met`; max 5 photos/criterion (constants).
- EXECUTED on-time window is date-only `America/Sao_Paulo`; after grace, `executed_late` is allowed and visible to the client.
- Cancel of SR during enrichment MUST abort enrichment; workers MUST NO-OP; MUST NOT materialize checklist; MUST NOT bootstrap matching.

**Architectural Principles:**

1. **Separate FSMs** — Enrichment readiness ≠ `service_request_status` ≠ matching `DISPATCH_*` ≠ `contracted_services.status` ([ADR-0001](./adr/0001-separate-enrichment-fsm-for-publication-readiness.md)).
2. **PostgreSQL as system of record** — FSM state, leases, schemas, drafts, evidence packages, ratings, and audit events are authoritative in Postgres.
3. **Edge Functions as I/O connectors** — LLM calls, storage orchestration, and wake-ups live in workers; transitions and invariants live in RPCs.
4. **Idempotency at every layer** — Bootstrap, materialize, EXECUTED submit, confirm+rating, auto-complete, and MMD enqueue MUST be safely retryable.
5. **Fail closed on publication** — No checklist ⇒ no matching. Fail open on AI only via template fallback after retries, never via empty schema or auto-cancel.
6. **Atomic product transitions** — Final EXECUTED submit and manual confirm+rating are single-TX/RPC boundaries.
7. **Observability first** — Every enrichment attempt, lease claim, fallback, EXECUTED, COMPLETED, and rating event MUST be correlatable in Sentry + `job_runs` / audit tables.

**Glossary & decisions:** Canonical terms and locked grill decisions are in [`CONTEXT.md`](./CONTEXT.md). Readiness ownership rationale is in [ADR-0001](./adr/0001-separate-enrichment-fsm-for-publication-readiness.md). If any requirement below contradicts the grill decision table in CONTEXT.md, **CONTEXT.md wins**.

---

## Assumptions

### Platform constants (seed defaults — decision 23)

| Key | Default |
| --- | ---: |
| `checklist_criterion_min` | 3 |
| `checklist_criterion_max` | 12 |
| `checklist_evidence_min` | 1 |
| `checklist_evidence_max` | 5 |
| `checklist_ai_max_attempts` | 3 |
| `enrichment_lease_ttl_seconds` | 120 |
| `enrichment_claim_batch_size` | 20 |
| `enrichment_retry_base_seconds` | 30 |
| `completion_evidence_orphan_ttl_hours` | 24 |
| `auto_complete_grace_hours` | 24 (existing) |

Dispute-stub support destination SHALL be configured via env / remote config, not `platform_constants`.


- **Runtime**: Node.js 24.13 (application layer), Deno (Supabase Edge Functions).
- **Frontend**: React 19, Vite 7, TypeScript, TanStack Query, Dynamic Form engine (`src/features/dynamic-form/`) for checklist schema render and response capture.
- **Backend**: Supabase PostgreSQL 15+, RLS on all new tables, Supabase Auth JWT sessions; `service_role` for workers/crons.
- **Existing CS lifecycle**: `contracted_services.status ∈ {PENDING_PAYMENT, CONFIRMED, EXECUTED, COMPLETED, CANCELLED}` — extend, do not invent a parallel CS FSM.
- **Completion RPCs (domain ownership)**: `service_completion_mark_executed`, `service_completion_confirm_with_rating`, `service_completion_auto_complete_executed` (+ cron wrappers with `job_runs`) — include checklist/evidence/`executed_late`/atomic rating. MUST NOT keep parallel product writers under `payment_*` for these transitions ([ADR-0004](./adr/0004-completion-rpcs-outside-payments.md)).
- **Existing ratings**: `service_ratings` with dimensions quality, punctuality, communication, value (1–5); RPCs `submit_service_rating` / `update_service_rating` (authenticated EXECUTE grants restored as needed); stats refresh triggers from matching ADR-0005 remain authoritative for ranking inputs.
- **Smart description**: Edge Function `generate-smart-description` remains **synchronous pre-create**; checklist enrichment is **asynchronous post-create** and MUST NOT block SR insert success beyond enqueueing enrichment.
- **Matching today**: Dispatch bootstrap trigger fires on first `service_requests` `OPEN` — this MUST change to enrichment `READY` handoff; the 5-minute `matching.dispatch_start_delay_minutes` applies only after bootstrap.
- **Queues / leases**: PostgreSQL table queues with `SELECT FOR UPDATE SKIP LOCKED`, `locked_until` / lease TTL, `job_runs` patterns as used by matching, payments, and MMD.
- **Scheduling**: `pg_cron` for enrichment sweeper, lease orphan recovery, auto-complete, and orphan media janitor.
- **Notifications**: Multichannel Message Dispatcher (`message_dispatcher` + `message-dispatcher-worker`) for push + email; `SERVICE_EXECUTED` pattern already exists and MUST be reused/extended.
- **AI provider**: External LLM invoked from Edge Function for checklist schema generation; subject to rate limits, timeouts, and content validation.
- **Storage**: Supabase Storage for evidence images via dedicated **completion evidence upload sessions** (KYC/chat pattern: create session → signed upload → register path); orphan janitor required. MUST NOT reuse request-quote photo bucket paths or chat media sessions.
- **Timezone**: Date-only calendars for EXECUTED on-time window use `America/Sao_Paulo`; payment shift timing (`payment_service_execution_at`) remains a separate clock.
- **Feature architecture**: App APIs under `src/features/service-completion/api/`; hooks orchestrate; components do not call Supabase directly; `view-services` imports only the feature public API.
- **At-least-once delivery**: Workers and crons are at-least-once; idempotency keys and UNIQUE constraints prevent duplicate side effects.
- **Ranking**: Completion checklist content does **not** participate in provider ranking; ratings produced after `COMPLETED` continue to feed `provider_rating_stats` as today.

---

## Operational Phases

1. **Service Request Create & Enrichment Enqueue Phase** — Persist SR; create enrichment row in `PENDING`; enqueue enrichment job; return success to client with “processing” UX projected from enrichment state. MUST NOT bootstrap matching.
2. **Enrichment Claim & Running Phase** — Worker leases job (`PENDING`/`retryable` → `RUNNING`), loads intake form_data + smart description context, invokes LLM.
3. **Schema Validation Phase** — Validate AI output against allowlist (`completion_criterion`, `static_text`), cardinality (3–12 `completion_criterion`), and structural integrity.
4. **Retry Phase** — On invalid schema, transient LLM/network failure, or lease-safe abort: increment attempt, schedule retry with backoff, release lease.
5. **Fallback Materialization Phase** — After max attempts: load checklist template by `platform_service` / category; materialize with source `fallback_template`; transition enrichment to `READY`.
6. **AI Materialization Phase** — On valid AI schema: persist immutable checklist with source `ai`; transition enrichment to `READY`.
7. **Matching Bootstrap Handoff Phase** — On transition to `READY` only: create `service_request_dispatches` (`DISPATCH_PENDING`, `next_batch_at = now() + matching.dispatch_start_delay_minutes`) if absent; identical uniqueness/idempotency guarantees as today’s OPEN trigger.
8. **Abort Phase** — On SR cancel before `READY`: enrichment → terminal aborted; workers NO-OP; no materialize; no matching bootstrap.
9. **Schema Exposure Phase** — After `READY`, expose checklist schema to client and to providers with access to the request (feed/detail/chat/proposal); responses remain hidden.
10. **Evidence Draft Phase** — While CS `CONFIRMED`, contracted provider MAY persist server-side draft responses/uploads; draft MUST be invisible to client.
11. **EXECUTED Submit Phase** — Provider final submit validates responses (including negative-item justification + required evidence), freezes evidence package, sets `executed_late` per temporal rules, transitions CS → `EXECUTED` atomically; enqueues MMD `SERVICE_EXECUTED`.
12. **Client Review & Manual Confirm+Rating Phase** — Client reviews immutable evidence; submits rating + confirm in one atomic TX/RPC → `COMPLETED` + `service_ratings`.
13. **Auto-Complete Phase** — Cron promotes `EXECUTED` → `COMPLETED` after grace (~24h) with `completed_by = system` and **without** requiring rating.
14. **Optional Post-Complete Rating Phase** — After auto-complete, client MAY submit/update rating while `COMPLETED` per matching rating rules.
15. **Dispute Stub Phase** — UI exposes dispute entry point as stub only (no dispute FSM in this scope).
16. **Monitoring, Lease Recovery & Janitor Phase** — Recover expired leases mid-LLM; reconcile stuck `RUNNING`; delete orphan uploads; emit metrics/audit.

---

## State Machine

### A. Enrichment FSM (publication readiness — source of truth)

- PENDING
- RUNNING
- READY
- ABORTED
- (operational substates recorded on attempts/events, not as CS/SR status): RETRY_SCHEDULED, FALLBACK_APPLIED

### B. Contracted Service Status (reuse — do not fork)

- PENDING_PAYMENT
- CONFIRMED
- EXECUTED
- COMPLETED
- CANCELLED

### C. Evidence Draft / Package (logical)

- DRAFT (mutable, server-side, CS = CONFIRMED, invisible to client)
- FROZEN_PACKAGE (immutable, created atomically with EXECUTED)
- ABSENT (no draft/package)

### D. Checklist Materialization Source

- ai
- fallback_template

### E. Matching Dispatch (downstream — unchanged enum; bootstrap timing changes)

- DISPATCH_PENDING
- DISPATCH_ACTIVE
- DISPATCH_PAUSED
- DISPATCH_STOPPED
- DISPATCH_MATCHED
- DISPATCH_FALLBACK_OPEN_MARKET
- DISPATCH_CANCELLED
- DISPATCH_EXPIRED

### State Definitions

#### Enrichment FSM

- **PENDING** *(initial)*: Enrichment row created with the service request. No worker owns the job yet (or retry re-queued). Matching MUST NOT bootstrap. Checklist MUST NOT exist yet (or prior partial artifacts MUST NOT be treated as published).
- **RUNNING** *(transient)*: A worker holds a valid lease and is executing LLM generation and/or validation. Concurrent workers MUST NOT process the same enrichment row. If lease expires mid-LLM call, another worker MAY reclaim; side effects MUST be idempotent.
- **READY** *(terminal success for readiness)*: Checklist schema materialized (source `ai` or `fallback_template`), immutable. Matching bootstrap handoff MUST run exactly once. UI “em processamento” MUST clear. Schema visibility rules apply.
- **ABORTED** *(terminal failure for readiness)*: Service request cancelled before readiness. No checklist materialization. No matching bootstrap. Workers MUST NO-OP if they observe cancel/ABORT. Irreversible for this enrichment row.
- **RETRY_SCHEDULED** *(attempt annotation)*: Not a separate durable FSM column required if encoded via `next_attempt_at` + `attempt_count` while status remains `PENDING` after failed `RUNNING`; documentation uses this label for clarity.
- **FALLBACK_APPLIED** *(event)*: Terminal AI failure path that still reaches `READY` with `fallback_template` source; MUST be audited.

#### Contracted Service Status (completion-relevant)

- **PENDING_PAYMENT**: Out of completion write-path; draft/EXECUTED MUST NOT apply.
- **CONFIRMED**: Provider MAY write evidence drafts; final EXECUTED submit is eligible subject to temporal gate (`scheduled_start_date` reached) and checklist presence.
- **EXECUTED**: Evidence package frozen; `executed_at` set; `executed_late` flag set per rules; awaiting client confirm or auto-complete; client + contracted provider MAY read responses; dispute stub MAY show.
- **COMPLETED**: Terminal happy path via manual confirm+rating or auto-complete; rating required only on manual path; optional rating after system auto-complete.
- **CANCELLED**: Terminal; completion transitions MUST NOT proceed.

#### Evidence

- **DRAFT**: Mutable responses + pending uploads for CS `CONFIRMED`; invisible to client; concurrent saves MUST be serialized or version-conflicted safely.
- **FROZEN_PACKAGE**: Snapshot of responses + attachment references at EXECUTED; immutable for provider self-serve; ops correction out of scope.
- **ABSENT**: No draft exists; final submit MAY create package directly without prior draft.

---

## Operational Architecture Constraints

The Service Completion & Publication Readiness subsystem SHALL operate as a persistence-first, asynchronously resumable, lease-owned pipeline with explicit transactional handoffs to matching and contracted-service lifecycles.

- The system SHALL persist enrichment state, checklist schemas, drafts, evidence packages, and audit events in PostgreSQL as the authoritative store.
- The system SHALL NOT treat `service_requests.status` as the source of truth for publication readiness ([ADR-0001](./adr/0001-separate-enrichment-fsm-for-publication-readiness.md)).
- Matching bootstrap SHALL occur only when enrichment reaches `READY` and SHALL NOT occur on SR `OPEN` insert alone.
- Enrichment processing SHALL NOT be conflated with the matching 5-minute dispatch start delay; the delay clock SHALL start at matching bootstrap after `READY`.
- Edge Function workers SHALL be stateless with respect to authoritative FSM state; durable state SHALL live in PostgreSQL.
- Workers SHALL claim work via `SELECT FOR UPDATE SKIP LOCKED` (or equivalent row lease) with a finite `locked_until` TTL.
- All enrichment, EXECUTED, confirm, auto-complete, and notification enqueue operations SHALL be idempotent under at-least-once delivery.
- The system MUST NOT publish (bootstrap matching / expose to providers as matchable) without a materialized checklist.
- The system MUST NOT auto-cancel a service request because AI checklist generation failed; after retries it MUST apply template fallback and reach `READY`.
- Checklist schema MUST be immutable after materialization; providers MAY write responses only at EXECUTED submit (and drafts while CONFIRMED).
- Evidence packages MUST be immutable after EXECUTED for self-serve actors.
- Manual client confirm MUST include rating in the same atomic TX/RPC; auto-complete MUST NOT require rating.
- Cancel of SR during enrichment MUST abort enrichment; workers MUST NO-OP; the system MUST NOT materialize checklist and MUST NOT bootstrap matching after abort.
- Checklist schemas MUST contain only allowlisted block types: `completion_criterion`, `static_text` ([ADR-0003](./adr/0003-completion-criterion-block.md)). Intake `yes_no` / `image_gallery` / top-level `evidence_images` MUST NOT appear as completion schema block types.
- Checklist schemas MUST contain between 3 and 12 `completion_criterion` items inclusive (bounds from `platform_constants`).
- `completion_criterion` with `met=false` SHALL be allowed for EXECUTED only with mandatory justification and required evidence; destination status remains `EXECUTED`.
- Dispute functionality SHALL be stub-only in this scope: UI affordance MUST open a human support channel (configured deep link / WhatsApp / email) without a dispute FSM; auto-complete MUST remain active.
- Ranking algorithms MUST NOT consume checklist schema or responses as ranking features; ratings after COMPLETED remain the ranking input.
- Notifications SHALL use MMD; completion flows MUST NOT invent a parallel notification bus.
- Long-running LLM calls SHALL NOT hold DB transactions open; lease ownership and materialize commit SHALL be separate phases with idempotent finalize.
- The system SHOULD prefer database RPCs for state transitions and Edge Functions for external I/O.
- The system MAY batch enrichment claims and auto-complete promotions per cron tick within bounded batch sizes.
- Ops/support amendment of frozen evidence is OUT OF SCOPE for MVP self-serve paths.

---

# Requirements

## Requirement 1: Enrichment Persistence and Readiness Source of Truth

*User Story*: As the platform, I want a durable enrichment FSM per service request so that publication readiness is explicit, queryable, and independent of negotiation status.

### Acceptance Criteria

1. **GIVEN** a service request is successfully created  
   **WHEN** the create transaction commits  
   **THEN** the system MUST insert exactly one enrichment record keyed by `service_request_id` with status `PENDING`, `attempt_count = 0`, and no checklist schema attached.

2. **GIVEN** an enrichment record exists  
   **WHEN** any subsystem evaluates whether matching may start or whether the request is visible to providers for dispatch  
   **THEN** it MUST read enrichment status (or an equivalent readiness projection derived solely from enrichment) and MUST NOT infer readiness from `service_requests.status` alone.

3. **GIVEN** enrichment status is `PENDING` or `RUNNING`  
   **WHEN** the client opens the request detail  
   **THEN** the UI MUST project an “em processamento / preparando publicação” state from enrichment, not from inventing a new `service_request_status` value.

4. **GIVEN** enrichment status is `READY`  
   **WHEN** readiness is queried  
   **THEN** the system MUST expose that a checklist schema exists, its `source ∈ {ai, fallback_template}`, and its materialized_at timestamp.

5. **GIVEN** two concurrent create retries for the same logical request  
   **WHEN** enrichment insert races  
   **THEN** a UNIQUE constraint on `service_request_id` MUST prevent duplicate enrichment rows; the loser MUST observe the existing row without creating a second FSM.

6. **GIVEN** enrichment is `ABORTED`  
   **WHEN** readiness is queried  
   **THEN** the system MUST report non-ready / aborted and MUST NOT present the request as published.

7. **GIVEN** ADR-0001  
   **WHEN** engineers propose encoding readiness as `service_request_status = PROCESSING` or as perpetual `DISPATCH_PENDING` without enrichment  
   **THEN** that design MUST be rejected as out of compliance with this requirement.

8. **GIVEN** enrichment row updates  
   **WHEN** status transitions occur  
   **THEN** each transition MUST be append-audited (enrichment events or equivalent) with actor (`system`/`worker`), from_status, to_status, correlation_id, and optional error payload.

---

## Requirement 2: Publication Gate and Matching Bootstrap Handoff

*User Story*: As the marketplace, I want matching to start only after checklist materialization so that providers never see incomplete requests and the 5-minute delay remains a post-readiness concern.

### Acceptance Criteria

1. **GIVEN** a new service request with `status = OPEN` and enrichment `PENDING`  
   **WHEN** the insert trigger that previously bootstrapped dispatch runs (legacy behavior)  
   **THEN** the system MUST NOT create `service_request_dispatches` solely from OPEN insert; bootstrap MUST be deferred to enrichment `READY` handoff.

2. **GIVEN** enrichment transitions to `READY`  
   **WHEN** the handoff runs in the same transaction as the READY commit (preferred) or in an immediately chained idempotent step  
   **THEN** the system MUST create `service_request_dispatches` with `DISPATCH_PENDING` and `next_batch_at = now() + matching.dispatch_start_delay_minutes` if no dispatch row exists.

3. **GIVEN** enrichment is already `READY` and a dispatch row already exists  
   **WHEN** READY handoff is retried  
   **THEN** the system MUST be a no-op regarding dispatch creation (UNIQUE `service_request_id`) and MUST NOT reset `next_batch_at` or invent a second delay.

4. **GIVEN** enrichment is `READY`  
   **WHEN** the matching 5-minute delay elapses  
   **THEN** progressive batch processing MAY open batch #1 per matching requirements; enrichment processing time MUST NOT be subtracted from or confused with that delay.

5. **GIVEN** enrichment is not `READY`  
   **WHEN** provider feed/list opportunities is queried  
   **THEN** the request MUST NOT appear as a matchable opportunity (no visibility grant from matching bootstrap that never ran).

6. **GIVEN** race: enrichment worker about to set `READY` while SR cancel commits `ABORTED`  
   **WHEN** both transactions contend  
   **THEN** exactly one outcome MUST win: either `ABORTED` with no checklist/no dispatch, or `READY` with checklist+dispatch only if cancel had not yet committed; if cancel wins, materialize/bootstrap MUST NOT proceed (see Requirement 7).

7. **GIVEN** enrichment `READY` handoff fails after schema materialize but before dispatch insert  
   **WHEN** recovery runs  
   **THEN** a sweeper MUST detect `READY` without dispatch row and complete bootstrap idempotently without regenerating the schema.

8. **GIVEN** matching documentation referencing OPEN-insert bootstrap  
   **WHEN** this feature ships  
   **THEN** matching bootstrap semantics MUST be updated to READY-handoff as the normative rule for new requests.

9. **GIVEN** `republish_cancelled_service_request` creates a new `OPEN` service request  
   **WHEN** the insert commits  
   **THEN** the system MUST enqueue enrichment `PENDING` for the **new** request (same helper as create-request) and MUST NOT bootstrap matching from the OPEN insert; MUST NOT copy enrichment/checklist from the cancelled source request.

---

## Requirement 3: Async Checklist Generation (AI Path)

*User Story*: As the platform, I want checklist schemas generated asynchronously from the request context so that create-request latency stays low and generation can retry safely.

### Acceptance Criteria

1. **GIVEN** enrichment `PENDING` is due (`next_attempt_at IS NULL OR next_attempt_at <= now()`)  
   **WHEN** an enrichment worker claims the row  
   **THEN** it MUST transition to `RUNNING`, set lease owner + `locked_until`, increment a claim token/generation, and commit before calling the LLM.

2. **GIVEN** a claimed enrichment job  
   **WHEN** the worker invokes the LLM  
   **THEN** it MUST NOT hold an open write transaction across the LLM HTTP call; finalize MUST be a separate idempotent commit keyed by claim token.

3. **GIVEN** LLM returns a candidate schema  
   **WHEN** validation passes (Requirement 4)  
   **THEN** the worker/RPC MUST persist the immutable checklist schema, set `source = 'ai'`, transition enrichment to `READY`, clear lease, and trigger matching bootstrap handoff.

4. **GIVEN** LLM returns invalid JSON / disallowed blocks / bad cardinality  
   **WHEN** attempts remain  
   **THEN** the system MUST record failure reason, increment `attempt_count`, schedule `next_attempt_at` with backoff, set status back to `PENDING` (or equivalent retryable), and release the lease.

5. **GIVEN** LLM times out or returns 5xx  
   **WHEN** the error is classified transient  
   **THEN** the same retry scheduling rules MUST apply; the system MUST NOT materialize a partial schema.

6. **GIVEN** `generate-smart-description` already ran at pre-create  
   **WHEN** checklist enrichment runs  
   **THEN** it MAY consume persisted smart description + form_data as inputs but MUST NOT re-implement pre-create sync description generation as a readiness gate.

7. **GIVEN** enrichment create succeeded  
   **WHEN** the client receives create-request success  
   **THEN** the API MUST NOT block on LLM completion; enrichment MUST proceed asynchronously.

8. **GIVEN** duplicate worker deliveries for the same claim  
   **WHEN** finalize runs twice  
   **THEN** only one schema materialization MUST persist; second finalize MUST no-op or conflict-safe merge without corrupting immutability.

9. **GIVEN** prompt/context size limits  
   **WHEN** intake payload is oversized  
   **THEN** the worker MUST truncate/summarize per documented limits, log the truncation, and still attempt generation; repeated validation failure still follows retry/fallback.

---

## Requirement 4: Checklist Schema Validation (Allowlist and Cardinality)

*User Story*: As the platform, I want strict schema validation so that only renderable, bounded completion checklists are materialized.

### Acceptance Criteria

1. **GIVEN** a candidate checklist schema  
   **WHEN** it contains any block type outside `{completion_criterion, static_text}` (including intake `yes_no`, `image_gallery`, or top-level `evidence_images`)  
   **THEN** validation MUST fail and the schema MUST NOT be materialized ([ADR-0003](./adr/0003-completion-criterion-block.md)).

2. **GIVEN** a candidate schema  
   **WHEN** the count of `completion_criterion` items is `< platform_constants.checklist_criterion_min` (default 3) or `> platform_constants.checklist_criterion_max` (default 12)  
   **THEN** validation MUST fail.

3. **GIVEN** a `completion_criterion` block  
   **WHEN** validating structure  
   **THEN** it MUST define an enunciado/label, a met/not-met answer slot, embedded evidence upload capability, and a justification slot required when `met=false`. Config MUST support `requires_evidence_when_met` (boolean). Evidence policy: `met=false` always requires ≥ `platform_constants.checklist_evidence_min` images (default 1) + justification; `met=true` requires evidence only when `requires_evidence_when_met=true`; per-criterion max images = `platform_constants.checklist_evidence_max` (default 5).

4. **GIVEN** `static_text` blocks  
   **WHEN** validating  
   **THEN** they MAY exist for instructions; they MUST NOT count toward `completion_criterion` cardinality.

5. **GIVEN** justification for unmet criteria  
   **WHEN** designing the schema  
   **THEN** justification MUST be a field of `completion_criterion` (not a separate free-form schema block type).

6. **GIVEN** validation failure  
   **WHEN** attempts remain  
   **THEN** the system MUST retry AI generation; when attempts are exhausted, MUST apply template fallback (Requirement 5).

7. **GIVEN** a template fallback schema  
   **WHEN** it is loaded  
   **THEN** it MUST pass the same allowlist and cardinality validation before materialization; if the template itself is invalid/missing, see Requirement 5 missing-template edge case.

8. **GIVEN** Dynamic Form engine constraints  
   **WHEN** schema is persisted  
   **THEN** it MUST be storable/renderable by the existing Dynamic Form renderer without forking a second form engine.

---

## Requirement 5: Template Fallback and Never-Publish-Without-Checklist

*User Story*: As operations, I want a deterministic fallback checklist when AI fails so that requests still publish without being auto-cancelled or published empty.

### Acceptance Criteria

1. **GIVEN** `attempt_count` reaches `platform_constants.checklist_ai_max_attempts`  
   **WHEN** the next failure occurs or the terminal attempt fails validation  
   **THEN** the system MUST resolve a checklist template by cascade **platform_service → category → global default**, then attempt materialization with `source = 'fallback_template'`.

2. **GIVEN** fallback materialization succeeds  
   **WHEN** commit completes  
   **THEN** enrichment MUST become `READY`, matching bootstrap MUST run, and audit MUST record fallback application with prior AI failure summaries.

3. **GIVEN** AI path exhausted  
   **WHEN** deciding product outcome  
   **THEN** the system MUST NOT auto-cancel the service request due to AI failure and MUST NOT transition to `READY` without a checklist schema.

4. **GIVEN** no template exists at any cascade level (service, category, or global)  
   **WHEN** fallback is required  
   **THEN** the system MUST mark enrichment in a retryable ops-attention state (or keep retrying with elevated alert), emit CRITICAL observability, and MUST NOT bootstrap matching; product MUST NOT silently publish empty. (Manual template seed / ops fix is the recovery path.)

5. **GIVEN** template exists but fails allowlist/cardinality  
   **WHEN** fallback runs  
   **THEN** treat as missing/invalid template (AC4): MUST NOT materialize; MUST alert; MUST NOT READY.

6. **GIVEN** materialized schema  
   **WHEN** reading `source`  
   **THEN** clients/ops MAY observe `ai` vs `fallback_template` for support; ranking MUST NOT use this field.

7. **GIVEN** fallback already applied and `READY`  
   **WHEN** a delayed AI response arrives  
   **THEN** the late AI result MUST be discarded; schema MUST remain immutable.

8. **GIVEN** concurrent fallback and AI finalize  
   **WHEN** both attempt materialize  
   **THEN** exactly one materialization MUST win; the other MUST no-op on observing schema already present / status already `READY`.

---

## Requirement 6: Enrichment Scheduling, Retry, Leasing, and Ownership

*User Story*: As a reliability engineer, I want leased, backoff-scheduled enrichment jobs so that concurrent workers do not duplicate LLM spend or corrupt state.

### Acceptance Criteria

1. **GIVEN** multiple enrichment workers  
   **WHEN** claiming due `PENDING` jobs  
   **THEN** they MUST use `FOR UPDATE SKIP LOCKED` (or equivalent) so each row is owned by at most one worker at a time.

2. **GIVEN** a lease TTL `platform_constants.enrichment_lease_ttl_seconds`  
   **WHEN** `locked_until < now()` while status is `RUNNING`  
   **THEN** a sweeper/other worker MAY reclaim the row, increment a lease generation, and retry; previous worker finalize with stale generation MUST be rejected.

3. **GIVEN** lease expiry mid-LLM call  
   **WHEN** the original worker later attempts finalize  
   **THEN** it MUST detect lease generation mismatch / loss of ownership and MUST NOT overwrite a newer attempt’s state; LLM cost may be wasted but state MUST remain consistent.

4. **GIVEN** retry backoff  
   **WHEN** scheduling `next_attempt_at`  
   **THEN** the system SHOULD use exponential backoff with jitter bounded by platform constants; attempts MUST be capped by max attempts before fallback.

5. **GIVEN** pg_cron enrichment sweeper  
   **WHEN** it fires  
   **THEN** it MUST (a) wake/claim due PENDING rows (or invoke Edge wake), (b) reclaim expired RUNNING leases, (c) complete READY-without-dispatch bootstrap repair, (d) record `job_runs` success/failure counts.

6. **GIVEN** worker crash after READY commit but before ack  
   **WHEN** job is redelivered  
   **THEN** processing MUST no-op safely (idempotent READY).

7. **GIVEN** batch claim size N per tick  
   **WHEN** backlog exists  
   **THEN** the worker/cron MUST process at most N rows per invocation to bound runtime; remaining due rows wait for next tick.

8. **GIVEN** distributed locking via leases  
   **WHEN** two regions/workers overlap  
   **THEN** database row locks/leases remain the sole ownership mechanism; application memory locks MUST NOT be authoritative.

---

## Requirement 7: Enrichment Abort on Service Request Cancel

*User Story*: As a client who cancels early, I want enrichment to stop so that cancelled requests never publish or notify providers.

### Acceptance Criteria

1. **GIVEN** enrichment is `PENDING` or `RUNNING`  
   **WHEN** the service request is cancelled  
   **THEN** the same transaction (preferred) MUST set enrichment to `ABORTED`, clear future `next_attempt_at`, and prevent further materialization.

2. **GIVEN** a worker holds a lease on an enrichment row  
   **WHEN** it re-reads status after LLM and finds SR cancelled or enrichment `ABORTED`  
   **THEN** it MUST NO-OP finalize (no schema persist, no READY, no matching bootstrap) and release/abandon the lease.

3. **GIVEN** cancel commits  
   **WHEN** matching bootstrap would have run  
   **THEN** the system MUST NOT create a dispatch row; if a dispatch row somehow exists, cancel paths from matching MUST mark `DISPATCH_CANCELLED` per matching rules — cancel-during-enrichment SHOULD normally prevent bootstrap entirely.

4. **GIVEN** race cancel vs READY  
   **WHEN** transactions serialize  
   **THEN** invariants MUST hold: `ABORTED` ⇒ no new checklist materialize and no new bootstrap; if `READY` won before cancel, subsequent SR cancel follows normal published-request cancel (matching cancel), which is outside enrichment abort semantics but MUST still stop dispatch.

5. **GIVEN** `ABORTED` enrichment  
   **WHEN** a delayed LLM response arrives  
   **THEN** it MUST be ignored.

6. **GIVEN** audit  
   **WHEN** abort occurs  
   **THEN** an enrichment event MUST record cancel reason correlation and actor.

7. **GIVEN** client UI  
   **WHEN** cancel succeeds during enrichment  
   **THEN** processing indicators MUST clear to cancelled state; no “published” messaging.

---

## Requirement 8: Checklist Schema Immutability and Visibility (Exposure Control)

*User Story*: As a client and as eligible providers, I want to read the checklist schema early, without exposing execution responses before EXECUTED.

### Acceptance Criteria

1. **GIVEN** enrichment is `READY`  
   **WHEN** the owning client fetches request detail  
   **THEN** the system MUST allow read access to the checklist schema.

2. **GIVEN** enrichment is `READY` and a provider has access to the request (feed visibility, detail, chat, or proposal paths per matching/CNS rules)  
   **WHEN** they fetch request detail  
   **THEN** the system MUST allow read access to the checklist schema.

3. **GIVEN** enrichment is not `READY`  
   **WHEN** schema is requested  
   **THEN** the API MUST return not-available / processing; MUST NOT leak partial AI drafts.

4. **GIVEN** checklist responses / evidence  
   **WHEN** CS status is not yet `EXECUTED`  
   **THEN** responses MUST NOT be readable by the client; draft responses MUST NOT be readable by the client.

5. **GIVEN** CS is `EXECUTED` or `COMPLETED`  
   **WHEN** the client or the contracted provider fetches evidence  
   **THEN** the system MUST allow read of the frozen evidence package; other providers MUST NOT read responses.

6. **GIVEN** schema materialized  
   **WHEN** any actor attempts to edit schema fields  
   **THEN** the system MUST reject writes; negotiation-time schema editing is OUT OF SCOPE.

7. **GIVEN** RLS policies  
   **WHEN** evaluating access  
   **THEN** schema read and response read MUST be separately enforced (exposure control).

8. **GIVEN** ranking / eligibility subsystems  
   **WHEN** scoring providers  
   **THEN** they MUST NOT require checklist response data; schema presence is a publication gate only, not a ranking feature.

---

## Requirement 9: Evidence Draft Persistence While CONFIRMED

*User Story*: As a provider, I want to save checklist progress on the server before final submit so that I do not lose work, without showing unfinished evidence to the client.

### Acceptance Criteria

1. **GIVEN** CS `status = CONFIRMED` and the caller is the contracted provider  
   **WHEN** they save draft responses/attachments  
   **THEN** the system MUST upsert a server-side draft bound to `contracted_service_id` and checklist schema version/id.

2. **GIVEN** a draft exists  
   **WHEN** the client requests evidence  
   **THEN** the system MUST NOT return draft contents (invisible to client).

3. **GIVEN** concurrent draft saves  
   **WHEN** two devices submit overlapping patches  
   **THEN** the system MUST use row-level locking and/or optimistic version (`draft_version`) so that writes are serializable; conflicting version MUST return a conflict error prompting reload.

4. **GIVEN** CS status ≠ `CONFIRMED`  
   **WHEN** draft save is attempted  
   **THEN** the RPC MUST reject with invalid status (except read-only after freeze).

5. **GIVEN** final EXECUTED submit  
   **WHEN** validation succeeds  
   **THEN** draft MUST be consumed into the frozen package and draft mutability MUST end atomically with status transition.

6. **GIVEN** orphan uploads referenced only by abandoned draft fields  
   **WHEN** janitor runs after TTL  
   **THEN** unreferenced objects MUST be deleted (Requirement 22).

7. **GIVEN** draft save  
   **WHEN** validating  
   **THEN** drafts MAY be incomplete; full validation MUST run only on final submit.

8. **GIVEN** idempotency key on draft save (optional but recommended)  
   **WHEN** the same key is retried  
   **THEN** the system MUST not create duplicate attachment rows for the same logical upload.

---

## Requirement 10: EXECUTED Transition with Checklist Validation (Lifecycle Extension)

*User Story*: As a provider, I want to mark the service executed with a complete evidence package so that the client can confirm delivery against clear criteria.

### Acceptance Criteria

1. **GIVEN** CS `status = CONFIRMED`, payment PAID as required by payment invariants, checklist schema exists for the SR  
   **WHEN** provider submits final execution package  
   **THEN** `service_completion_mark_executed` MUST validate all required checklist responses in the same transaction that transitions to `EXECUTED`.

2. **GIVEN** final submit  
   **WHEN** validation passes  
   **THEN** the system MUST atomically: freeze evidence package; set `executed_at = now()`; set `executed_late` per Requirement 11; set `status = EXECUTED`; write audit `SERVICE_EXECUTED`; enqueue MMD notification to client; invalidate draft writes.

3. **GIVEN** duplicate EXECUTED submit  
   **WHEN** CS is already `EXECUTED` with frozen package  
   **THEN** the RPC MUST be idempotent: return success with existing state OR conflict with `ALREADY_EXECUTED` without mutating package/status.

4. **GIVEN** required `completion_criterion` unanswered or required evidence missing  
   **WHEN** submit occurs  
   **THEN** the RPC MUST reject; status MUST remain `CONFIRMED`; draft MAY remain.

5. **GIVEN** unmet criterion (`met=false`) without justification or without required evidence  
   **WHEN** submit occurs  
   **THEN** the RPC MUST reject per Requirement 13.

6. **GIVEN** CS status ≠ `CONFIRMED`  
   **WHEN** submit occurs  
   **THEN** the RPC MUST return `INVALID_STATUS_TRANSITION`.

7. **GIVEN** checklist schema missing (should be impossible post-READY matching, but defensive)  
   **WHEN** submit occurs  
   **THEN** the RPC MUST fail closed with a clear error; MUST NOT transition to EXECUTED without package.

8. **GIVEN** notification enqueue fails after status commit  
   **WHEN** using outbox/MMD patterns  
   **THEN** at-least-once enqueue recovery MUST send `SERVICE_EXECUTED` without re-entering EXECUTED transition.

9. **GIVEN** legacy callers of mark-executed without checklist payload  
   **WHEN** this feature is enabled  
   **THEN** they MUST be rejected; app versions MUST send checklist responses.

---

## Requirement 11: Temporal Rules for On-Time Window and `executed_late`

*User Story*: As the marketplace, I want date-only BRT execution windows so that late executions remain possible but are clearly flagged to the client.

### Acceptance Criteria

1. **GIVEN** CS scheduling fields  
   **WHEN** computing the on-time window  
   **THEN** the system MUST use date-only values in `America/Sao_Paulo`: `start = scheduled_start_date`; `effective_end = coalesce(scheduled_end_date, scheduled_start_date)`; on-time ceiling date = `effective_end + 1 day`.

2. **GIVEN** current BRT date `D`  
   **WHEN** `D < scheduled_start_date`  
   **THEN** EXECUTED submit MUST be rejected (`SERVICE_NOT_YET_DUE` or equivalent); drafts MAY still be saved while CONFIRMED.

3. **GIVEN** `scheduled_start_date <= D <= effective_end + 1 day`  
   **WHEN** EXECUTED submit succeeds  
   **THEN** `executed_late` MUST be `false`.

4. **GIVEN** `D > effective_end + 1 day`  
   **WHEN** EXECUTED submit succeeds  
   **THEN** `executed_late` MUST be `true` and MUST be visible to the client on review UI.

5. **GIVEN** after on-time ceiling  
   **WHEN** provider self-serve EXECUTED  
   **THEN** the system MUST still allow EXECUTED (no hard block in MVP).

6. **GIVEN** payment helper `payment_service_execution_at` (timestamptz shift clock)  
   **WHEN** evaluating EXECUTED eligibility  
   **THEN** completion temporal rules MUST NOT replace payment charge/cancel clocks; only the date-only window above governs `executed_late` / not-yet-due for mark-executed.

7. **GIVEN** reschedule updates `scheduled_start_date` / `scheduled_end_date` while CONFIRMED  
   **WHEN** later EXECUTED submit occurs  
   **THEN** on-time/`executed_late` MUST be computed from the updated dates.

8. **GIVEN** auto-complete cron  
   **WHEN** promoting EXECUTED → COMPLETED  
   **THEN** it MUST NOT clear or reinterpret `executed_late`; the flag remains historical.

---

## Requirement 12: Evidence Package Immutability

*User Story*: As a client, I want execution evidence to stay frozen after EXECUTED so that confirmation reviews a stable record.

### Acceptance Criteria

1. **GIVEN** CS is `EXECUTED` or `COMPLETED`  
   **WHEN** the contracted provider attempts to patch responses or replace attachments  
   **THEN** the system MUST reject self-serve mutation.

2. **GIVEN** frozen package  
   **WHEN** storage objects are referenced  
   **THEN** the package MUST store stable object identities/checksums sufficient for audit; silent overwrite of underlying objects MUST be prevented via storage immutability policies or versioned paths.

3. **GIVEN** ops/support amendment  
   **WHEN** considered for MVP  
   **THEN** it is OUT OF SCOPE; requirements MUST NOT implement provider re-edit.

4. **GIVEN** client confirm or auto-complete  
   **WHEN** transitioning to COMPLETED  
   **THEN** the evidence package MUST remain unchanged.

5. **GIVEN** dispute stub  
   **WHEN** clicked  
   **THEN** it MUST NOT mutate the evidence package.

6. **GIVEN** audit trail  
   **WHEN** EXECUTED commits  
   **THEN** a hash or canonical JSON snapshot of responses SHOULD be stored for tamper evidence.

---

## Requirement 13: Unmet `completion_criterion`, Justification, and Required Evidence

*User Story*: As a provider who could not meet a criterion, I want to mark it unmet with justification and evidence so that I can still reach EXECUTED without a special status.

### Acceptance Criteria

1. **GIVEN** a `completion_criterion` answered with `met=false`  
   **WHEN** final EXECUTED submit runs  
   **THEN** a non-empty justification text on that criterion MUST be present or the submit MUST fail.

2. **GIVEN** a criterion with `met=false`, or with `requires_evidence_when_met=true` and `met=true`  
   **WHEN** submit runs  
   **THEN** image count for that criterion MUST be in `[checklist_evidence_min, checklist_evidence_max]` (defaults 1–5) or the submit MUST fail; `met=false` MUST also include justification.

3. **GIVEN** one or more unmet criteria with valid justification + evidence and all required criteria answered  
   **WHEN** submit succeeds  
   **THEN** CS status MUST be `EXECUTED` (no intermediate status).

4. **GIVEN** client review UI  
   **WHEN** rendering negatives  
   **THEN** it MUST highlight unmet items, show justification and evidence, and allow confirm+rating or dispute stub.

5. **GIVEN** justification  
   **WHEN** persisting  
   **THEN** it MUST be part of the frozen package, not a free-floating comment elsewhere.

6. **GIVEN** empty/whitespace justification  
   **WHEN** validating  
   **THEN** it MUST fail.

7. **GIVEN** all items positive with required evidence  
   **WHEN** submit runs  
   **THEN** justification fields MUST NOT be required.

---

## Requirement 14: Manual Client Confirm with Atomic Rating

*User Story*: As a client, I want to confirm delivery and rate the provider in one step so that COMPLETED always carries my evaluation on the manual path.

### Acceptance Criteria

1. **GIVEN** CS `status = EXECUTED` and caller is the owning client  
   **WHEN** they submit confirm with scores quality, punctuality, communication, value (each 1–5) and optional comment  
   **THEN** a single TX/RPC MUST: insert `service_ratings`; set CS `COMPLETED`, `completed_at = now()`, `completed_by = 'client'`; write audit `SERVICE_COMPLETED`; enqueue provider notification.

2. **GIVEN** manual confirm payload missing any required score  
   **WHEN** submit occurs  
   **THEN** the RPC MUST reject; CS MUST remain `EXECUTED`; no partial rating row.

3. **GIVEN** rating insert and status update  
   **WHEN** either fails  
   **THEN** the entire transaction MUST roll back (no COMPLETED without rating on manual path; no orphan rating without COMPLETED).

4. **GIVEN** `submit_service_rating` / related grants  
   **WHEN** manual confirm path is implemented  
   **THEN** authenticated EXECUTE privileges MUST be restored/available as needed; prefer a dedicated confirm+rating RPC that composes invariants rather than trusting multi-call client sagas.

5. **GIVEN** duplicate confirm  
   **WHEN** CS already `COMPLETED`  
   **THEN** the RPC MUST be idempotent or return `ALREADY_COMPLETED` without creating duplicate ratings (UNIQUE on `contracted_service_id` for ratings).

6. **GIVEN** auto-complete vs manual confirm race  
   **WHEN** both run concurrently  
   **THEN** exactly one transition to COMPLETED MUST win; if system auto-complete wins, manual confirm MUST NOT overwrite `completed_by` or invent a second rating unless optional post-complete rating rules apply (Requirement 16); if manual wins first, auto-complete MUST no-op.

7. **GIVEN** provider rating stats triggers  
   **WHEN** rating inserts  
   **THEN** existing matching triggers MUST refresh `provider_rating_stats` as today.

8. **GIVEN** UI flow  
   **WHEN** designing screens  
   **THEN** order MUST be: review checklist/evidence → enter ratings → confirm; dispute stub MAY be adjacent but MUST NOT be required to complete.

---

## Requirement 15: Auto-Complete Without Rating

*User Story*: As the platform, I want services to complete automatically after grace so that providers are not blocked indefinitely when clients are inactive.

### Acceptance Criteria

1. **GIVEN** CS `status = EXECUTED` and `executed_at + auto_complete_grace` elapsed (default ~24h from `platform_constants.auto_complete_grace_hours`)  
   **WHEN** `service_completion_cron_auto_complete_executed` runs (invoking `service_completion_auto_complete_executed`)  
   **THEN** it MUST set `COMPLETED`, `completed_by = 'system'`, `completed_at = now()`, audit `SERVICE_AUTO_COMPLETED`, notify client — and MUST NOT require or invent a rating.

2. **GIVEN** auto-complete batch  
   **WHEN** processing many rows  
   **THEN** each row MUST be lease/lock safe and individually idempotent; failures on one row MUST NOT abort unrelated rows.

3. **GIVEN** CS already COMPLETED  
   **WHEN** cron selects candidates  
   **THEN** it MUST skip (duplicate prevention).

4. **GIVEN** chargeback/`is_disputed` payment flags  
   **WHEN** auto-complete runs  
   **THEN** completion MUST still proceed per existing payment Requirement 32 policy unless a newer payment rule explicitly blocks (default: do not block).

5. **GIVEN** manual confirm happens milliseconds earlier  
   **WHEN** cron attempts update  
   **THEN** `UPDATE … WHERE status = 'EXECUTED'` pattern MUST ensure zero double-complete.

6. **GIVEN** notifications  
   **WHEN** auto-complete succeeds  
   **THEN** MMD MUST inform the client that confirmation was automatic and that rating remains available (Requirement 16).

7. **GIVEN** job_runs  
   **WHEN** cron finishes  
   **THEN** scanned/succeeded/failed counts MUST be recorded.

---

## Requirement 16: Optional Rating After Auto-Complete

*User Story*: As a client whose service was auto-completed, I want to rate later so that provider quality signals remain available.

### Acceptance Criteria

1. **GIVEN** CS `COMPLETED` with `completed_by = 'system'` and no rating row  
   **WHEN** client submits rating via `submit_service_rating` (or equivalent)  
   **THEN** the system MUST accept rating while matching edit-window rules allow.

2. **GIVEN** CS `COMPLETED` with `completed_by = 'client'` and rating already created atomically  
   **WHEN** client updates scores within edit window  
   **THEN** `update_service_rating` rules from matching MUST apply.

3. **GIVEN** edit window expired (matching 48h rule)  
   **WHEN** update attempted  
   **THEN** the system MUST reject.

4. **GIVEN** CS not `COMPLETED`  
   **WHEN** standalone rating submit attempted outside confirm RPC  
   **THEN** the system MUST reject (ratings are post-completion artifacts), except as composed inside manual confirm TX.

5. **GIVEN** duplicate submit  
   **WHEN** rating already exists  
   **THEN** UNIQUE constraint / RPC MUST prevent duplicates; use update path instead.

6. **GIVEN** ranking  
   **WHEN** optional late rating arrives  
   **THEN** stats triggers MUST update ranking inputs; checklist still MUST NOT affect ranking.

---

## Requirement 17: Dispute Stub

*User Story*: As a client who disagrees with execution evidence, I want a visible dispute action that is explicitly non-functional beyond stub behavior in this scope.

### Acceptance Criteria

1. **GIVEN** CS is `EXECUTED` (and optionally `COMPLETED`)  
   **WHEN** client UI renders review  
   **THEN** a dispute entry-point MAY be shown.

2. **GIVEN** user activates dispute stub  
   **WHEN** handling the action  
   **THEN** the system MUST NOT create a dispute aggregate, MUST NOT change CS status, MUST NOT mutate evidence, and SHOULD show “em breve” / contact support messaging.

3. **GIVEN** analytics  
   **WHEN** stub is clicked  
   **THEN** the system SHOULD emit an analytics event for demand sensing.

4. **GIVEN** future dispute system  
   **WHEN** scoped later  
   **THEN** it is OUT OF SCOPE for these requirements beyond the stub.

5. **GIVEN** negative checklist items  
   **WHEN** client still confirms  
   **THEN** confirm+rating MUST remain available; dispute stub MUST NOT be mandatory.

---

## Requirement 18: Idempotency, Duplicate Prevention, and Transaction Coordination

*User Story*: As the platform, I want every critical transition to be safely retryable so that at-least-once workers and double-taps do not corrupt lifecycle state.

### Acceptance Criteria

1. **GIVEN** enrichment finalize, matching bootstrap, EXECUTED submit, confirm+rating, auto-complete, and MMD enqueue  
   **WHEN** retried with the same logical key  
   **THEN** side effects MUST occur at most once (UNIQUE constraints + status predicates).

2. **GIVEN** client retries confirm with an `Idempotency-Key`  
   **WHEN** the first request committed  
   **THEN** the second MUST return the same completion outcome without duplicate ratings.

3. **GIVEN** EXECUTED submit idempotency key  
   **WHEN** network timeout after commit  
   **THEN** replay MUST not create a second package.

4. **GIVEN** multi-step client sagas (save draft → upload → submit)  
   **WHEN** specifying architecture  
   **THEN** final status transition MUST remain one server TX; clients MUST NOT be required to orchestrate COMPLETED + rating in two unprotected calls.

5. **GIVEN** outbox pattern for notifications  
   **WHEN** status TX commits  
   **THEN** notification intent SHOULD be written in the same TX and dispatched asynchronously.

6. **GIVEN** enrichment READY + bootstrap  
   **WHEN** coordinated  
   **THEN** prefer same TX; if split, recovery sweeper MUST guarantee eventual bootstrap exactly once.

7. **GIVEN** auto-complete and manual confirm  
   **WHEN** racing  
   **THEN** row lock on `contracted_services` MUST serialize winners (Requirement 14 AC6).

8. **GIVEN** duplicate media upload callbacks  
   **WHEN** attaching to draft  
   **THEN** content-addressed or upload-id uniqueness MUST prevent duplicate attachment rows.

---

## Requirement 19: Concurrency Control and Distributed Locking

*User Story*: As workers operating in parallel, I want SKIP LOCKED leases so that enrichment and completion crons scale horizontally without double processing.

### Acceptance Criteria

1. **GIVEN** enrichment claim  
   **WHEN** two workers compete  
   **THEN** only one MUST obtain the row lease.

2. **GIVEN** auto-complete cron variants running overlap  
   **WHEN** selecting EXECUTED due rows  
   **THEN** `FOR UPDATE SKIP LOCKED` MUST prevent double completion.

3. **GIVEN** draft_version optimistic concurrency  
   **WHEN** stale write arrives  
   **THEN** MUST fail with conflict, not silent overwrite.

4. **GIVEN** EXECUTED submit  
   **WHEN** concurrent with draft save  
   **THEN** submit MUST take a strong lock; concurrent draft save MUST fail after freeze.

5. **GIVEN** advisory locks  
   **WHEN** used  
   **THEN** they MAY augment but MUST NOT replace row predicates for status transitions.

6. **GIVEN** Edge Function concurrency limits  
   **WHEN** backlog grows  
   **THEN** DB queue depth MUST remain the buffer; workers MUST remain computationally bounded per invocation.

7. **GIVEN** lock wait timeouts  
   **WHEN** occurring under load  
   **THEN** operations MUST fail safely for retry without partial commits across TX boundaries.

---

## Requirement 20: Queue Orchestration, Async Execution, Batch Processing, and Scalability

*User Story*: As the platform, I want PostgreSQL-backed queues and bounded batches so that enrichment scales with request volume without long-lived in-memory workers.

### Acceptance Criteria

1. **GIVEN** enrichment work  
   **WHEN** orchestrated  
   **THEN** it MUST use durable queue/state rows + cron/Edge wake, not always-on processes.

2. **GIVEN** batch size constants  
   **WHEN** sweeper runs  
   **THEN** it MUST process ≤ configured batch size per tick for enrichment reclaim, bootstrap repair, auto-complete, and orphan janitor.

3. **GIVEN** LLM rate limits  
   **WHEN** many PENDING jobs exist  
   **THEN** workers SHOULD pace claims (token bucket / max concurrent LLM calls) to avoid thundering herds; excess remains queued.

4. **GIVEN** horizontal scale-out of Edge workers  
   **WHEN** N replicas run  
   **THEN** correctness MUST hold via DB leases; throughput MAY scale roughly linearly until LLM/provider limits.

5. **GIVEN** long LLM latency  
   **WHEN** designing timeouts  
   **THEN** function wall-clock timeout MUST be < lease TTL with margin, or heartbeat lease extension MUST be implemented; otherwise reclaim semantics apply (Requirement 6).

6. **GIVEN** matching batches after READY  
   **WHEN** load increases  
   **THEN** publication readiness subsystem MUST NOT become a bottleneck beyond enrichment backlog; matching retains its own batch scheduler.

7. **GIVEN** storage upload volume  
   **WHEN** providers draft many images  
   **THEN** direct signed uploads MUST bypass Edge body proxying; Edge SHOULD only finalize metadata.

8. **GIVEN** backlog SLO  
   **WHEN** enrichment PENDING age exceeds threshold  
   **THEN** observability MUST alert (Requirement 21).

---

## Requirement 21: Observability, Auditability, and Event Processing

*User Story*: As on-call engineers, I want correlatable logs, job_runs, and audit events so that enrichment failures and completion disputes are diagnosable.

### Acceptance Criteria

1. **GIVEN** any enrichment attempt  
   **WHEN** started/finished  
   **THEN** structured logs MUST include `service_request_id`, enrichment_id, attempt, lease_generation, correlation_id, and outcome.

2. **GIVEN** LLM failures / validation failures / fallback  
   **WHEN** occurring  
   **THEN** Sentry MUST capture with tags distinguishing transient vs terminal vs fallback.

3. **GIVEN** EXECUTED / COMPLETED / AUTO_COMPLETED / rating events  
   **WHEN** committed  
   **THEN** payment/completion audit log (or dedicated completion audit) MUST record actor, timestamps, and `executed_late`.

4. **GIVEN** cron jobs  
   **WHEN** completing  
   **THEN** `job_runs` MUST store scanned/succeeded/failed and error samples.

5. **GIVEN** MMD enqueue  
   **WHEN** notification intent is created  
   **THEN** event processing MUST be traceable from CS id → dispatcher message id.

6. **GIVEN** ABORT / READY races  
   **WHEN** investigated  
   **THEN** enrichment event history MUST be sufficient to explain the winner.

7. **GIVEN** metrics  
   **WHEN** exported or queried  
   **THEN** the system SHOULD track enrichment age p50/p95, AI vs fallback ratio, EXECUTED late ratio, auto-complete ratio, confirm+rating success rate.

8. **GIVEN** PII in logs  
   **WHEN** logging checklist text  
   **THEN** logs SHOULD redact unnecessary personal data; evidence URLs MUST NOT be broadly logged.

---

## Requirement 22: Failure Recovery, Timeout Handling, Orphan Uploads, and Janitor

*User Story*: As the platform, I want automatic recovery from worker crashes, expired leases, and abandoned uploads so that the system self-heals.

### Acceptance Criteria

1. **GIVEN** RUNNING enrichment with expired lease  
   **WHEN** sweeper runs  
   **THEN** it MUST reclaim and reschedule without duplicate READY schemas.

2. **GIVEN** READY without dispatch row  
   **WHEN** sweeper runs  
   **THEN** it MUST bootstrap matching idempotently.

3. **GIVEN** LLM timeout  
   **WHEN** worker returns  
   **THEN** attempt MUST count as failure/retry per policy; partial outputs discarded.

4. **GIVEN** storage objects uploaded but never referenced by draft/package after TTL  
   **WHEN** orphan janitor runs  
   **THEN** objects MUST be deleted; janitor MUST be idempotent and rate-limited.

5. **GIVEN** objects referenced by frozen packages  
   **WHEN** janitor runs  
   **THEN** they MUST NOT be deleted.

6. **GIVEN** missing template fallback  
   **WHEN** detected  
   **THEN** CRITICAL alert + non-READY hold MUST persist until ops seeds template (Requirement 5).

7. **GIVEN** invalid AI schema repeatedly  
   **WHEN** max attempts reached and template OK  
   **THEN** fallback MUST recover publication automatically.

8. **GIVEN** Edge wake failures (pg_net)  
   **WHEN** occurring  
   **THEN** next cron tick MUST still claim due work (cron as safety net).

---

## Requirement 23: Eligibility, Visibility, Ranking Neutrality, and Exposure Control Summary

*User Story*: As product and matching owners, I want clear rules that checklist readiness gates exposure but does not alter ranking math.

### Acceptance Criteria

1. **GIVEN** enrichment ≠ `READY`  
   **WHEN** provider eligibility/visibility for the SR is evaluated for matching  
   **THEN** the SR MUST be ineligible for batch generation and feed opportunity listing.

2. **GIVEN** enrichment = `READY`  
   **WHEN** matching runs  
   **THEN** standard matching eligibility (geo, operational_status, credentialing gates, etc.) applies unchanged.

3. **GIVEN** ranking features  
   **WHEN** computing operational scores  
   **THEN** checklist schema, source (`ai`/`fallback_template`), responses, and `executed_late` MUST NOT be ranking inputs in this scope.

4. **GIVEN** `service_ratings` after COMPLETED  
   **WHEN** stats refresh  
   **THEN** ranking MAY update via existing rating stats — this is rating-driven, not checklist-driven.

5. **GIVEN** schema visibility vs response visibility  
   **WHEN** enforcing RLS  
   **THEN** Requirement 8 rules MUST hold as the exposure-control baseline.

6. **GIVEN** contracted provider vs other providers  
   **WHEN** reading responses post-EXECUTED  
   **THEN** only client + contracted provider are eligible.

7. **GIVEN** publication marketing language  
   **WHEN** used in UI  
   **THEN** it MUST mean enrichment READY + matching visibility rules, not merely SR OPEN.

---

## Requirement 24: Notifications via Message Dispatcher

*User Story*: As users, I want reliable push and email when execution is declared or completion occurs so that confirmation and rating actions are timely.

### Acceptance Criteria

1. **GIVEN** successful EXECUTED transition  
   **WHEN** side effects run  
   **THEN** the system MUST enqueue MMD message(s) to the client using the existing `SERVICE_EXECUTED` pattern (extend template copy for checklist/late flags as needed).

2. **GIVEN** manual COMPLETED  
   **WHEN** committed  
   **THEN** provider MUST receive completion notification via MMD.

3. **GIVEN** auto-complete  
   **WHEN** committed  
   **THEN** client MUST receive auto-complete notification mentioning optional rating.

4. **GIVEN** enrichment READY  
   **WHEN** considering notifications  
   **THEN** the system MUST NOT spam providers solely because enrichment finished; provider notifications remain matching-batch driven.

5. **GIVEN** MMD at-least-once  
   **WHEN** enqueue retries  
   **THEN** dispatcher idempotency keys MUST prevent duplicate user-visible spam where the dispatcher supports dedupe.

6. **GIVEN** email+push channels  
   **WHEN** configuring templates  
   **THEN** both MAY be used per MMD event config; completion events SHOULD follow payment/matching bypass-priority patterns where urgency requires.

7. **GIVEN** notification failure  
   **WHEN** status already committed  
   **THEN** recovery MUST retry notify without reverting CS status.

---

## Requirement 25: State Transitions Matrix and Lifecycle Invariants

*User Story*: As implementers, I want an explicit transition matrix so that illegal jumps are rejected uniformly across RPCs and workers.

### Acceptance Criteria

1. **GIVEN** enrichment transitions  
   **WHEN** applied  
   **THEN** only the following are legal: `PENDING→RUNNING`, `RUNNING→PENDING` (retry), `RUNNING→READY`, `PENDING→READY` (fallback shortcut if implemented in one step), `PENDING|RUNNING→ABORTED`; `READY` and `ABORTED` are terminal for enrichment.

2. **GIVEN** CS completion-relevant transitions  
   **WHEN** applied  
   **THEN** legal paths remain: `CONFIRMED→EXECUTED` (provider submit), `EXECUTED→COMPLETED` (client confirm or system auto-complete); `CANCELLED` blocks further completion writes.

3. **GIVEN** illegal transition  
   **WHEN** attempted  
   **THEN** RPC MUST reject with stable error codes; no partial evidence freeze.

4. **GIVEN** schema materialize  
   **WHEN** enrichment not in materializing path  
   **THEN** MUST NOT attach schema to `ABORTED` rows.

5. **GIVEN** draft  
   **WHEN** CS leaves CONFIRMED without EXECUTED (e.g., cancel)  
   **THEN** draft MUST become read-only/abandoned; janitor MAY clean uploads.

6. **GIVEN** executed_late flag  
   **WHEN** CS not EXECUTED  
   **THEN** flag MUST be null/false and unsettable.

7. **GIVEN** documentation  
   **WHEN** onboarding engineers  
   **THEN** this matrix plus CONTEXT.md grill table are normative.

8. **GIVEN** payment PENDING_PAYMENT  
   **WHEN** provider attempts EXECUTED  
   **THEN** MUST reject (calendar/payment invariants unchanged).

---

## Implementation Guidance

- **Do not invent parallel CS status enums.** Implement `service_completion_mark_executed`, `service_completion_confirm_with_rating`, and `service_completion_auto_complete_executed` (+ cron); remove legacy `payment_*` completion product APIs ([ADR-0004](./adr/0004-completion-rpcs-outside-payments.md)).
- **Implement enrichment as its own tables/FSM** per ADR-0001; remove or gate the OPEN-insert matching bootstrap trigger in favor of READY handoff + repair sweeper.
- **Keep AI I/O in Edge Functions**; keep transition RPCs in Postgres; never hold transactions open across LLM HTTP.
- **Reuse Dynamic Form** with a new `completion_criterion` block (ADR-0003); enforce allowlist/cardinality at materialize and again at EXECUTED submit. Do not compose intake `yes_no` + `image_gallery`.
- **Compose manual confirm+rating in one RPC**; restore `submit_service_rating` / `update_service_rating` grants for post-auto-complete path.
- **Reuse MMD** for `SERVICE_EXECUTED` and completion notifications; reuse `job_runs`, leases, pg_cron patterns from matching/payments/MMD.
- **Seed checklist templates** with cascade coverage (per `platform_service`, category, and a **global** default) before enabling fallback in production; missing templates at all levels are CRITICAL.
- **Seed platform_constants** per decision 23 table (criterion 3–12, evidence 1–5, AI attempts 3, lease 120s, batch 20, retry base 30s, orphan TTL 24h; reuse `auto_complete_grace_hours=24`).
- **Feature modules**: MUST use `src/features/service-completion/` as the app ownership boundary (enrichment UX, checklist fill, confirm+rating, feature APIs). `view-services` consumes its public API. Payments feature retains money movement only (`payment_*` NetCred/settlement). Matching bootstrap remains matching-owned. API layer mandatory.
- **Tests**: pgTAP for FSM transitions, cancel races, idempotent EXECUTED/confirm, executed_late boundaries (BRT date), fallback materialize; Deno tests for LLM validation/retry; Vitest for hooks/UI gates.
- **Docs sync**: update matching requirements bootstrap wording when implementing; keep CONTEXT.md glossary authoritative.
- **Cutover:** database will be reset in current development phase — no legacy OPEN grandfather/backfill. Enrichment gate applies to all post-deploy requests.
- **Out of scope**: negotiation schema editing; full dispute FSM; ops evidence amendment UI; ranking features from checklist; changing `generate-smart-description` to async readiness.

---

## O que deve ficar no PostgreSQL

| Concern | Placement | Notes |
| --- | --- | --- |
| Enrichment FSM row + status | PostgreSQL | Source of truth for publication readiness |
| Enrichment attempts/events/audit | PostgreSQL | Retry reasons, abort, fallback applied |
| Lease columns (`locked_by`, `locked_until`, generation) | PostgreSQL | SKIP LOCKED ownership |
| Checklist schema (immutable JSON) + `source` | PostgreSQL | AI or fallback_template |
| Checklist templates (service → category → global) | PostgreSQL | Versioned fallback catalog |
| Matching dispatch bootstrap on READY | PostgreSQL trigger/RPC | Idempotent handoff |
| Evidence draft + version | PostgreSQL | CONFIRMED only; RLS hides from client |
| `completion_evidence_upload_sessions` + storage paths | PostgreSQL + Storage | Session lifecycle + orphan janitor |
| Frozen evidence package + `executed_late` | PostgreSQL | Atomic with EXECUTED |
| `contracted_services` status transitions | PostgreSQL RPCs | Extend payment RPCs |
| `service_ratings` | PostgreSQL | Manual confirm TX + optional later |
| Idempotency keys / UNIQUE guards | PostgreSQL | Duplicate prevention |
| `platform_constants` bounds & TTLs | PostgreSQL | Cardinality, attempts, leases, grace |
| `job_runs` for crons/sweepers | PostgreSQL | Operability |
| Outbox / MMD enqueue intents | PostgreSQL | Same-TX notify intent |
| RLS policies for schema vs responses | PostgreSQL | Exposure control |

---

## O que deve ficar na camada de aplicação

| Concern | Placement | Notes |
| --- | --- | --- |
| “Em processamento” UX from enrichment | App (hooks + UI) | Project enrichment state |
| Checklist schema render (Dynamic Form) | App | Reuse `dynamic-form` |
| Provider draft UX + offline-tolerant saves | App | Calls API/RPCs only |
| EXECUTED wizard (responses, negatives, uploads) | App | Final submit one API call |
| Client review + confirm+rating flow | App | Single confirm RPC |
| Optional post-auto-complete rating UI | App | Uses rating RPCs |
| Dispute stub UI → support channel + analytics | App | No dispute FSM; auto-complete continues |
| `executed_late` badge for client | App | Read-only flag |
| Feature API modules (no direct Supabase in components) | App `api/` | Per feature-architecture |
| Evidence upload session UX (create → upload → register) | App | Dedicated completion sessions; not chat/KYC buckets |

---

## O que deve ficar em Workers/Edge Functions

| Concern | Placement | Notes |
| --- | --- | --- |
| LLM checklist generation HTTP | Edge worker | No authoritative FSM in memory |
| Schema validation before finalize RPC | Edge and/or RPC | Defense in depth |
| Enrichment claim loop / wake handler | Edge + pg_cron | Leases in DB |
| Lease expiry reclaim orchestration | Edge/cron calling RPCs | Generation checks |
| Template fallback finalize orchestration | Edge/RPC | After max attempts |
| MMD worker delivery (push/email) | Existing MMD worker | Reuse |
| Orphan upload janitor | Edge/cron | Deletes unreferenced storage |
| Bootstrap repair sweeper wake | cron → RPC (± Edge) | READY without dispatch |
| Auto-complete cron | pg_cron → payment RPC | Extend existing |
| Rate limiting / pacing toward LLM | Edge | Protect provider quotas |
| Correlation logging to Sentry | Edge `_shared` logger | Include IDs |

---
