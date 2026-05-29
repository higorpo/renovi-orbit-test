# Implementation Tasks - Conversational Negotiation & Chat System (CNS)

## Execution Strategy

CNS delivery SHALL follow a **database-first, RPC-centric, async-decoupled** implementation order aligned with design §13.10 Waves A–F. PostgreSQL MUST become the sole source of truth for workflow state before any client cutover; Edge Functions and React features MUST consume stable RPC contracts only after migrations and RLS are in place.

### Implementation order and architectural dependencies

1. **Wave A (Foundation)** — Enums, core tables (`chats`, `chat_messages`, `service_request_negotiation_stats`, `domain_events`, audit, idempotency), RLS helper functions, read-only RLS policies, `platform_constants` seeds, Storage bucket scaffolding. **Unblocks:** schema validation, pgTAP fixtures, type generation.
2. **Wave B (Transactional core)** — All `cns_*` mutation RPCs and helper functions (`cns_chat_free_messaging_allowed`, rate limit, reciprocity probe, domain event recorder, idempotency cache). **Unblocks:** integration tests, RPC invocation from client once UI ships.
3. **Wave C (Proposal evolution)** — `provider_proposals` column migration; status map `submitted`→`PENDING`; partial unique index one `PENDING` per conversation; legacy 48h SLA removal. **Unblocks:** composer migration.
4. **Wave D (Composer cutover)** — `negotiation-proposals` feature; `submit_proposal` from client; legacy `create_provider_proposal` delegates internally. **Unblocks:** proposal-gated messaging E2E.
5. **Wave E (Accept cascade)** — `service_requests` status enum migration; `services` table; `accept_proposal` + `cancel_service_request`; 24h SLA via `chats.proposal_response_sla_hours`. **Unblocks:** contractual service creation (Req. 23).
6. **Wave F (Notifications & UX)** — MMD template registration; `cns_process_domain_events` + `cns_mmd_ingest`; push suppression hook; Realtime publication; full frontend feature split (`chats` + `negotiation-proposals`).

**Critical path:** Wave A → `cns_send_message` → reciprocity/expiry cron → `cns_process_domain_events` → RLS hardening → frontend → verification.

**Transactional dependencies:** Slot accounting (§3.3.1) MUST ship with `cns_send_message` and reciprocity job; accept cascade MUST NOT deploy without `services` table and SR enum migration; MMD ingest MUST NOT run inside mutation RPC transactions (OAC-09, G5).

### Rollout strategy

- **Phased enablement:** internal dogfood → staging soak (72h) with cron jobs active → canary cohort (5% providers) → full rollout. No client feature flag gates CNS routes or RPC calls; waves sequence backend and UI delivery, not a toggle.
- **Backward compatibility:** Legacy quote/proposal flows MUST remain functional until Wave D; SR status migration uses enum cast for local dev (production backfill deferred).
- **Wave B validation:** MAY exercise mutation RPCs in staging (pgTAP, integration tests) before Wave F UI is complete; client cutover follows route registration in Phase 13–14.

### Validation strategy

- **pgTAP:** FSM transitions, slot races, RLS matrix (R35), proposal-gated messaging (R34), idempotency replay.
- **Vitest:** Hook-level cursor merge, push suppression, offline accept block.
- **Playwright:** Mobile-safari keyboard safety, send/accept happy path.
- **Operational:** `job_runs` metrics, `cns_domain_events_backlog` gauge, proposal expiry lag alert (R21-AC05).

### Risk isolation

| Risk | Isolation |
|------|-----------|
| Accept cascade partial failure | Single RPC transaction; pgTAP proves atomicity (R7-AC07, R26-AC03) |
| Slot counter drift | §3.3.1: counter is admission gate; temporary ACTIVE count MAY exceed limit on reactivation |
| MMD outage | Outbox decoupling; G5 — committed state survives notification loss (R30-AC02) |
| Legacy SLA conflict | Wave E drops 48h cron before enabling 24h `cns_expire_pending_proposals` |
| RLS exposure | Wave A enables RLS on all new tables before production read paths |

### Incremental strategy

Squads MAY parallelize after Wave A: **DB** (Phases 1–3, 11), **Async** (Phases 4–6, 9–10), **Edge** (Phase 7), **Read** (Phase 8, 12), **FE** (Phase 13 after Wave B RPC stubs). Frontend MUST use MSW/mock RPC until Wave B merges.

### Recovery and rollback

- **Rollback Wave F:** Revert UI deploy or route registration if needed; legacy proposal path remains if Wave D not cutover.
- **Rollback Wave E:** MUST NOT rollback SR `COMPLETED` with existing `services` FK — forward-fix only pre-production.
- **Dead-letter outbox:** `cns_replay_domain_event` for operator recovery; MMD dedupe via stable `idempotency_key`.
- **Orphan media:** `cns_janitor_orphan_media` daily `0 3 * * *`; client retry with same message `idempotency_key`.
- **Stale leases:** `cns_release_stale_leases` each minute before domain event checkout.

### Observability and security gates (release blockers)

- RLS enabled on every new CNS table in same migration (R35-AC11).
- Mutation RPCs `SECURITY DEFINER` with in-function participant revalidation (R35-AC14, OAC-12).
- Audit triggers on conversation/proposal status changes (R21-AC01).
- Cron jobs registered only after corresponding RPC pgTAP green.

### Migration file order (`supabase/migrations/`)

Dev-first: **one migration file per SQL task**, timestamp `YYYYMMDDHHMMSS` defines apply order on `yarn db:reset`. Tasks **1–13** use `20260701100000`–`20260701101200`. **Do not** place task 23+ SQL before the slots reserved for tasks **14–21**.

| Task | Timestamp (reserved / applied) | Expected migration file (create when implementing) |
|------|-------------------------------|-----------------------------------------------------|
| 14 | `20260701101300` | `20260701101300_evolve_provider_proposals_cns.sql` |
| 15 | `20260701101400` | `20260701101400_create_chat_media_upload_sessions.sql` |
| ~~16~~ | ~~`20260701101500`~~ | ~~`chat_maintenance_queue`~~ — **cancelled** (cron scans `chats` directly; no maintenance queue in v1) |
| 17 | `20260701101600` | `20260701101600_create_cns_rls_helper_functions.sql` |
| 18 | `20260701101700` | `20260701101700_enable_cns_realtime_publication.sql` |
| 19 | `20260701101800` | `20260701101800_create_cns_audit_triggers.sql` |
| 20 | `20260701101900` | `20260701101900_remove_legacy_proposal_expiry_48h.sql` |
| 21 | `20260701102000` | `20260701102000_seed_cns_mmd_notification_templates.sql` |
| 22 | — | No SQL migration (run `yarn generate-supabase-types` after 14–21 land) |
| **23** | **`20260701102200`** | **`20260701102200_create_record_domain_event.sql`** (implemented; moved from `01300` so 14–21 apply first) |
| **24** | **`20260701102300`** | **`20260701102300_create_idempotency_helpers.sql`** (implemented; moved from `01400`) |

**Note:** Tasks 23–24 were implemented early (Wave B loop). Their files were renumbered to `02200` / `02300` so a full reset applies Wave A completion (14–21) before `record_domain_event` and idempotency helpers. New Wave B SQL from task 25 onward SHOULD use timestamps `20260701102400` and up unless this table is updated.

---

# Phase 1: Database Foundation

## 1. [x] Create CNS PostgreSQL enum types

Description:
Implement migration creating all normative CNS enum types per design §3.1.

Responsibilities:
- Define FSM enum values matching platform-flow.mmd
- Document legacy provider_proposals.status mapping

Implementation Details:
- Migration YYYYMMDDHHMMSS_create_cns_enums.sql
- Types: cns_conversation_status, cns_closure_type, cns_inactivation_reason, cns_message_type, cns_delivery_status, proposal_status, proposal_revision_reason, service_request_status, contracted_service_status

Deliverables:
- Migration SQL
- Mapping comment block

Dependencies:
- None — first CNS migration

Runtime Guarantees:
- Enum values immutable at runtime

Failure Handling:
- Failed migration aborts deploy

Observability:
- CI db:migrate log

Security Considerations:
- No PII in types

Performance Considerations:
- Metadata-only

Requirements covered:
2, 15

Acceptance Criteria covered:
R2-AC01, R15-AC01, R15-AC02, OAC-01

## 2. [x] Create public.chats table and indexes

Description:
Create chats with UNIQUE(service_request_id, provider_id) and reciprocity partial index per design §3.2.

Responsibilities:
- Persist ACTIVE|INACTIVE|CLOSED FSM
- Enforce closed/inactive CHECK constraints

Implementation Details:
- DDL §3.2
- Indexes: sr_status, last_interaction, provider_status, client_status, reciprocity_poll

Deliverables:
- Migration SQL
- pgTAP fixture seed helper

Dependencies:
- Task 1

Runtime Guarantees:
- One chat per (SR, provider) pair (R4-AC07)

Failure Handling:
- Unique violation → idempotent return in RPC

Observability:
- Optional row count metric

Security Considerations:
- RLS in Task 72; no authenticated INSERT

Performance Considerations:
- List and cron index coverage

Requirements covered:
1, 4, 11, 15, 29

Acceptance Criteria covered:
R1-AC01, R4-AC07, R15-AC01, R29-AC06

## 3. [x] Create service_request_negotiation_stats slot counter

Description:
Materialized per-SR active_chat_count counter per design §3.3; semantics §3.3.1.

Responsibilities:
- Admission counter not hard COUNT(*) invariant
- Update only inside RPCs

Implementation Details:
- DDL §3.3
- Comment block for §3.3.1 transition matrix

Deliverables:
- Migration SQL

Dependencies:
- Task 1

Runtime Guarantees:
- Delta in same TX as status transition (OAC-14)
- Reactivation: delta 0
- New ACTIVE: +1 if admitted
- INACTIVE/CLOSED from ACTIVE: -1
- Accept: set 0

Failure Handling:
- FOR UPDATE on stats row serializes slot race

Observability:
- Gauge cns_active_chats_per_sr

Security Considerations:
- RPC-only mutation

Performance Considerations:
- FOR UPDATE under slot contention

Requirements covered:
4, 33

Acceptance Criteria covered:
R4-AC01, R4-AC02, R32-AC04, OAC-14

## 4. [x] Create public.chat_messages table and indexes

Description:
Append-only messages with scoped idempotency and keyset indexes per design §3.4.

Responsibilities:
- UNIQUE(chat_id, sender_user_id, idempotency_key)
- Payload cap 65536 bytes

Implementation Details:
- DDL §3.4
- DESC and ASC pagination indexes

Deliverables:
- Migration SQL

Dependencies:
- Tasks 1, 2

Runtime Guarantees:
- Duplicate idempotency returns existing row (R14-AC01)

Failure Handling:
- Unique catch in cns_send_message

Observability:
- cns_send_message_duration_ms histogram

Security Considerations:
- RLS Task 73

Performance Considerations:
- chat_id leading indexes

Requirements covered:
3, 14, 15, 16

Acceptance Criteria covered:
R3-AC01, R3-AC08, R14-AC01, R15-AC02

## 5. [x] Create public.chat_read_receipts table

Description:
Per-user read cursor PK(chat_id, user_id) per design §3.5.

Responsibilities:
- Upsert from cns_mark_conversation_read
- Power unread badges in list_conversations

Implementation Details:
- DDL §3.5

Deliverables:
- Migration SQL

Dependencies:
- Task 2

Runtime Guarantees:
- One row per participant per conversation

Failure Handling:
- Concurrent upsert last-write-wins

Observability:
- Unread counts in list RPC

Security Considerations:
- Participant RLS

Performance Considerations:
- PK O(1) lookup

Requirements covered:
3, 17

Acceptance Criteria covered:
R3-AC10, R17-AC04

## 6. [x] Create public.services contracted service table

Description:
Contracted service row created only in accept cascade per design §3.7.

Responsibilities:
- UNIQUE(service_request_id)
- UNIQUE(accepted_proposal_id)
- PENDING_PAYMENT initial status
- Agreed execution window from client selected_slot (not a single date): duration_unit/value, scheduled_start_date, scheduled_end_date (days only), scheduled_shift, agreed_slot jsonb

Implementation Details:
- DDL §3.7; aligns with provider composer (proposal_suggested_slots) and accept picker

Deliverables:
- Migration SQL

Dependencies:
- Task 1

Runtime Guarantees:
- Insert in accept TX; failure rolls back SR COMPLETED (R23-AC03)

Failure Handling:
- FK violation aborts accept

Observability:
- accept_proposal_total counter

Security Considerations:
- RLS Task 75

Performance Considerations:
- Accept p95 <3s

Requirements covered:
2, 7, 23

Acceptance Criteria covered:
R2-AC04, R7-AC02, R15-AC05, R23-AC01, R23-AC03

## 7. [x] Create public.domain_events transactional outbox

Description:
Outbox with lease, retry, dead_letter columns per design §3.8.

Responsibilities:
- Normative event_type registry
- CHATS_CLOSED_BULK single row per SR

Implementation Details:
- DDL §3.8
- Partial indexes unprocessed/stale/dead_letter

Deliverables:
- Migration SQL
- Event catalog comment

Dependencies:
- Task 1

Runtime Guarantees:
- Insert in mutation TX (R28-AC01)
- At-least-once consumer

Failure Handling:
- Retry then dead_letter after 5 failures

Observability:
- cns_domain_events_backlog gauge

Security Considerations:
- Admin/service_role read

Performance Considerations:
- SKIP LOCKED batch 100

Requirements covered:
12, 24, 28

Acceptance Criteria covered:
R24-AC02, R28-AC01, R28-AC02, OAC-09

## 8. [x] Create public.rpc_idempotency_records table

Description:
RPC response cache per design §3.10.

Responsibilities:
- Cache response_body for PostgREST timeout replay (R27-AC03)

Implementation Details:
- UNIQUE(actor_user_id, operation, idempotency_key)

Deliverables:
- Migration SQL

Dependencies:
- Task 1

Runtime Guarantees:
- Exactly-once response for mutations

Failure Handling:
- Return cached body on duplicate

Observability:
- Log idempotency hits

Security Considerations:
- Actor-scoped keys

Performance Considerations:
- Unique index lookup

Requirements covered:
14, 27

Acceptance Criteria covered:
R14-AC01, R27-AC03, OAC-04, OAC-08

## 9. [x] Create chat_audit and proposal_audit tables

Description:
Append-only audit per design §3.11; triggers in Task 20.

Responsibilities:
- Capture from_status, to_status, actor_id, metadata

Implementation Details:
- bigserial PK
- Index chat_id/proposal_id + created_at

Deliverables:
- Migration SQL

Dependencies:
- Task 1

Runtime Guarantees:
- Same TX as status UPDATE

Failure Handling:
- Trigger failure rolls back status change

Observability:
- Support audit replay Task 63

Security Considerations:
- Admin read RLS Task 77

Performance Considerations:
- Time-range queries

Requirements covered:
21

Acceptance Criteria covered:
R15-AC07, R21-AC01, R21-AC04

## 10. [x] Seed platform_constants and platform_constant_int helper

Description:
Operational limits seeds and runtime reader per design §3.12.

Responsibilities:
- Default slots=4, reciprocity=24h, SLA=24h
- Clamp and fallback semantics

Implementation Details:
- platform_constant_int() with upper_bound clamp
- ON CONFLICT DO UPDATE seeds

Deliverables:
- Migration SQL
- Helper function

Dependencies:
- Existing platform_constants

Runtime Guarantees:
- Read per TX — no stale cache (R33-AC04)

Failure Handling:
- Log INVALID_PLATFORM_CONSTANT_FALLBACK

Observability:
- Warning on clamp

Security Considerations:
- Readable for display cache

Performance Considerations:
- Single-row lookup

Requirements covered:
4, 9, 33

Acceptance Criteria covered:
R33-AC01, R33-AC02, R33-AC04, R33-AC05, R33-AC06, R33-AC07

## 11. [x] Create chat_rate_limit_buckets table

Description:
Anti-spam sliding window per design §3.14.

Responsibilities:
- 30 msg/min/conversation/user default

Implementation Details:
- PK (chat_id, user_id, window_started_at)

Deliverables:
- Migration SQL

Dependencies:
- Tasks 2, 10

Runtime Guarantees:
- 429 RATE_LIMITED before insert

Failure Handling:
- ON CONFLICT increment count

Observability:
- Rate limit rejection metric

Security Considerations:
- Scoped buckets

Performance Considerations:
- Optional old window prune

Requirements covered:
3, 31

Acceptance Criteria covered:
R3-AC11

## 12. [x] Create job_runs batch telemetry table

Description:
Cron job metrics per design §3.15.

Responsibilities:
- processed_count, transitioned_count, error_count, duration_ms

Implementation Details:
- Index (job_name, started_at desc)

Deliverables:
- Migration SQL

Dependencies:
- Task 1

Runtime Guarantees:
- One row per cron invocation (R25-AC05)

Failure Handling:
- NULL finished_at alerts stale runs

Observability:
- Ops dashboard queries

Security Considerations:
- SECURITY DEFINER cron insert

Performance Considerations:
- Append-mostly

Requirements covered:
25, 21

Acceptance Criteria covered:
R25-AC05, R21-AC05

# Phase 2: Persistence Layer & Schema Evolution

## 13. [x] Migrate service_requests status to CNS enum

Description:
Evolve service_requests to OPEN|COMPLETED|CANCELLED; add completed_at, cancelled_at, contracted_service_id per design §3.16.

Responsibilities:
- Cast legacy text status to enum for local seeds (open→OPEN, cancelled→CANCELLED, closed→OPEN in dev)
- MUST NOT add accepted_proposal_id to SR (R15-AC04)

Implementation Details:
- ALTER to service_request_status enum; add completed_at, cancelled_at, contracted_service_id

Deliverables:
- Migration SQL
- Optional dev sanity-check script

Dependencies:
- Tasks 1, 6

Runtime Guarantees:
- Terminal timestamps immutable (R2-AC08)

Failure Handling:
- n/a (dev cast only)

Observability:
- Optional script reports status distribution

Security Considerations:
- No contract fields on SR

Performance Considerations:
- Batch update off-peak

Requirements covered:
2, 15, 23

Acceptance Criteria covered:
R2-AC01, R2-AC03, R15-AC04, R23-AC02

## 14. [x] Evolve provider_proposals for CNS versioning

Description:
Add chat_id, version, revision_count, revision_reason, submitted_at, expired_at, selected_slot; partial unique PENDING per conversation §3.6.

Responsibilities:
- Map submitted→PENDING
- revision_count CHECK 0..2

Implementation Details:
- ALTER TABLE §3.6
- Index chat_id+status
- One PENDING partial unique
- Migration file (order): `supabase/migrations/20260701101300_evolve_provider_proposals_cns.sql` — see §Migration file order

Deliverables:
- Migration SQL

Dependencies:
- Tasks 2, 1

Runtime Guarantees:
- One PENDING per conversation enforced

Failure Handling:
- Migration idempotent ADD COLUMN IF NOT EXISTS

Observability:
- Count migrated rows

Security Considerations:
- RPC-only mutations post-Wave D

Performance Considerations:
- Index supports timeline hydration

Requirements covered:
6, 10, 15

Acceptance Criteria covered:
R6-AC02, R10-AC01, R15-AC03

## 15. [x] Create chat_media_upload_sessions and Storage bucket chat-media

Description:
Two-phase upload session binding per design §3.13; bucket path {chat_id}/{upload_session_id}/{filename}.

Responsibilities:
- status pending|completed|expired
- expires_at default now()+24h

Implementation Details:
- Storage bucket RLS participant read
- Session table DDL §3.13
- Migration file (order): `supabase/migrations/20260701101400_create_chat_media_upload_sessions.sql` — see §Migration file order

Deliverables:
- Migration SQL
- Storage policy migration

Dependencies:
- Task 2

Runtime Guarantees:
- Session binds Edge upload to participant

Failure Handling:
- Expired session blocks attach

Observability:
- Orphan session count metric

Security Considerations:
- Participant-scoped Storage RLS (R35-AC04)

Performance Considerations:
- Janitor batch delete Task 49

Requirements covered:
3, 26, 31

Acceptance Criteria covered:
R3-AC06, R26-AC02, R35-AC04

## 16. [cancelled] Create optional chat_maintenance_queue table

**Cancelled:** v1 uses cron RPCs that scan indexed `chats` directly (`cns_evaluate_reciprocity_batch`, etc.). No `chat_maintenance_queue` table or `USE_MAINTENANCE_QUEUE` flag. Leases for async work use `domain_events` and MMD `message_dispatches` (Req. 27).

Description:
Optional queue for heavy backfill per design §3.9; MAY defer if cron scans chats directly.

Responsibilities:
- ~~job_type reciprocity_check|reconcile_delivery~~
- ~~UNIQUE(job_type, chat_id)~~

Implementation Details:
- ~~DDL §3.9~~
- ~~Feature flag env USE_MAINTENANCE_QUEUE default false~~
- ~~Migration file (order): `supabase/migrations/20260701101500_create_chat_maintenance_queue.sql`~~ — removed

Deliverables:
- ~~Migration SQL (optional)~~ — none

Dependencies:
- Task 2

Runtime Guarantees:
- Lease 30s on checkout (R27-AC01) — satisfied via `domain_events` consumer (task 45/47), not this table

Failure Handling:
- Janitor requeues expired leases — `cns_release_stale_leases` on `domain_events` (task 47)

Observability:
- Queue depth gauge if enabled — N/A without queue

Security Considerations:
- Worker-only access — N/A

Performance Considerations:
- SKIP LOCKED dequeue — cron batch on `chats` partial indexes instead

Requirements covered:
27

Acceptance Criteria covered:
R27-AC01, R27-AC02 — re-mapped to `domain_events` / task 47 in traceability matrix

## 17. [x] Create RLS helper functions is_platform_admin and is_chat_participant

Description:
Security invoker helpers per design §11.2 with initplan-safe auth.uid() usage.

Responsibilities:
- STABLE SQL functions SET search_path=public
- (select auth.uid()) pattern (R35-AC13)

Implementation Details:
- CREATE FUNCTION §11.2
- Migration file (order): `supabase/migrations/20260701101600_create_cns_rls_helper_functions.sql` — see §Migration file order

Deliverables:
- Migration SQL

Dependencies:
- profiles table exists

Runtime Guarantees:
- Correct boolean for admin and participant checks

Failure Handling:
- None — read-only helpers

Observability:
- Used in policy explain plans

Security Considerations:
- SECURITY INVOKER not DEFINER

Performance Considerations:
- Initplan avoids per-row auth eval

Requirements covered:
31, 35

Acceptance Criteria covered:
R35-AC12, R35-AC13, R35-AC14

## 18. [x] Enable Supabase Realtime publication for CNS tables

Description:
Add chat_messages and provider_proposals to supabase_realtime publication per design §5.4.

Responsibilities:
- REPLICA IDENTITY FULL on provider_proposals if old/new needed
- RLS filters Realtime delivery

Implementation Details:
- ALTER PUBLICATION statements §5.4
- Migration file (order): `supabase/migrations/20260701101700_enable_cns_realtime_publication.sql` — see §Migration file order

Deliverables:
- Migration SQL

Dependencies:
- Tasks 4, 14

Runtime Guarantees:
- At-least-once Realtime delivery (OAC-18)

Failure Handling:
- Client dedupe by message id

Observability:
- Channel subscription metrics

Security Considerations:
- Only RLS-visible rows delivered

Performance Considerations:
- Per-conversation channel not global fanout

Requirements covered:
13, 22

Acceptance Criteria covered:
R13-AC02, R22-AC02, OAC-18

## 19. [x] Implement audit triggers on conversation and proposal status

Description:
AFTER UPDATE OF status triggers insert audit rows in same transaction per design §3.11.

Responsibilities:
- Populate from_status/to_status/actor_id from session
- metadata jsonb for closure_reason etc.

Implementation Details:
- Trigger functions SECURITY DEFINER minimal
- Attach to chats and provider_proposals
- Migration file (order): `supabase/migrations/20260701101800_create_cns_audit_triggers.sql` — see §Migration file order

Deliverables:
- Trigger migration
- pgTAP transition audit test

Dependencies:
- Tasks 9, 14

Runtime Guarantees:
- Audit insert atomic with status change (R21-AC01)

Failure Handling:
- Trigger exception rolls back update

Observability:
- Audit replay ordered by created_at

Security Considerations:
- No client INSERT to audit tables

Performance Considerations:
- Trigger overhead negligible vs RPC

Requirements covered:
21

Acceptance Criteria covered:
R15-AC07, R21-AC01, R21-AC04

## 20. [x] Remove legacy 48h proposal expiry cron and accept guard

Description:
Drop expire_stale_provider_proposals and 48h trigger; prepare for 24h cns_expire_pending_proposals per design Schema evolution.

Responsibilities:
- Document cutover timing with Wave E
- Ensure no double-expiry during migration window

Implementation Details:
- DROP cron job migration
- DROP trigger migration
- Migration file (order): `supabase/migrations/20260701101900_remove_legacy_proposal_expiry_48h.sql` — see §Migration file order

Deliverables:
- Migration SQL

Dependencies:
- Task 14

Runtime Guarantees:
- Legacy path disabled before 24h cron enabled

Failure Handling:
- Coordinate deploy order Wave E

Observability:
- Log dropped object names

Security Considerations:
- N/A

Performance Considerations:
- Avoid concurrent legacy+new expiry jobs

Requirements covered:
9, 25

Acceptance Criteria covered:
R9-AC01, R25-AC02

## 21. [x] Register MMD notification templates for CNS events

Description:
Register chat.new_message, proposal.*, proposal.expiring_soon templates with normative variables §5.5.

Responsibilities:
- Variables: chat_id, service_request_id, deep_link_path
- Align with message_dispatcher schema

Implementation Details:
- SQL seed migration in message_dispatcher
- Template variable JSON schema doc
- Migration file (order): `supabase/migrations/20260701102000_seed_cns_mmd_notification_templates.sql` — see §Migration file order

Deliverables:
- Migration SQL
- Template registry rows

Dependencies:
- MMD schema exists

Runtime Guarantees:
- Templates available before Wave F consumer

Failure Handling:
- Missing template logs NOTIFICATION_SKIPPED

Observability:
- Template registration audit

Security Considerations:
- Service role only for seed

Performance Considerations:
- N/A

Requirements covered:
12

Acceptance Criteria covered:
R12-AC01, R12-AC03, R9-AC07

## 22. [x] Run yarn generate-supabase-types after Wave A schema

Description:
Regenerate TypeScript database types for new CNS tables and enums.

Responsibilities:
- Commit updated src/types/supabase generated file
- CI fails if types drift

Implementation Details:
- yarn generate-supabase-types
- No SQL migration (run after migrations for tasks 14–21; see §Migration file order)

Deliverables:
- Updated types file
- CI check

Dependencies:
- Tasks 1-21 SQL complete (tasks 1–13 applied; 14–21 when implemented)

Runtime Guarantees:
- Types match deployed schema

Failure Handling:
- Regenerate on migration failure fix

Observability:
- CI artifact

Security Considerations:
- No secrets in types

Performance Considerations:
- N/A

Requirements covered:
15

Acceptance Criteria covered:
R15-AC01, R15-AC02

# Phase 3: Core Transactional Orchestration

## 23. [x] Implement record_domain_event helper function

Description:
SECURITY DEFINER helper inserting domain_events rows with validated event_type and payload shape.

Responsibilities:
- Reject unknown event_type
- Populate service_request_id/chat_id FKs when provided

Implementation Details:
- Called inside mutation RPCs same TX
- Payload MUST include MMD idempotency_key when notification expected
- Migration file (order): `supabase/migrations/20260701102200_create_record_domain_event.sql` — MUST apply after tasks 14–21 (see §Migration file order)
- pgTAP: `supabase/tests/chats/record_domain_event_test.sql`

Deliverables:
- SQL function `public.record_domain_event`
- Unit pgTAP insert test

Dependencies:
- Task 7

Runtime Guarantees:
- Atomic with caller transaction

Failure Handling:
- Propagate SQL error to rollback caller

Observability:
- event_type label on insert log

Security Considerations:
- No direct grant to authenticated

Performance Considerations:
- Single INSERT per call

Requirements covered:
28

Acceptance Criteria covered:
R28-AC01, R28-AC06

## 24. [x] Implement idempotency_begin and idempotency_commit helpers

Description:
Internal helpers managing rpc_idempotency_records lookup/insert for mutation RPCs (cross-feature).

Responsibilities:
- begin: return cached response if exists
- commit: persist success response_body

Implementation Details:
- Used by accept, submit, cancel, close
- Migration file (order): `supabase/migrations/20260701102300_create_idempotency_helpers.sql` — MUST apply after task 23 / tasks 14–21 (see §Migration file order)
- pgTAP: `supabase/tests/chats/idempotency_duplicate_accept_test.sql`

Deliverables:
- SQL functions `public.idempotency_begin`, `public.idempotency_commit`
- pgTAP duplicate accept test

Dependencies:
- Task 8

Runtime Guarantees:
- PostgREST timeout replay safe (R27-AC03)

Failure Handling:
- Conflict on mismatched request_hash → 409

Observability:
- Idempotency hit counter

Security Considerations:
- Callable only from other cns RPCs

Performance Considerations:
- Single row upsert

Requirements covered:
14, 27

Acceptance Criteria covered:
R14-AC01, R14-AC02, R27-AC03

## 25. [x] Implement cns_chat_free_messaging_allowed function

Description:
Authoritative Req. 34 gate: false when PENDING proposal exists; true when REVISION_REQUESTED and no PENDING per design §4.2.1.

Responsibilities:
- STABLE SECURITY INVOKER
- Returns false for non-participants without leaking proposal state

Implementation Details:
- SQL §4.2.1
- pgTAP matrix R34 scenarios

Deliverables:
- SQL function

Dependencies:
- Tasks 14, 25 helper is_chat_participant

Runtime Guarantees:
- Server-side truth for gating (OAC-13)

Failure Handling:
- Used by cns_send_message before insert

Observability:
- None standalone

Security Considerations:
- No grant to bypass RPC checks

Performance Considerations:
- Index-only EXISTS on provider_proposals partial

Requirements covered:
34, 32

Acceptance Criteria covered:
R34-AC01, R34-AC11, R34-AC05, OAC-13

## 26. [x] Implement cns_check_message_rate_limit function

Description:
Increment sliding window bucket; RAISE RATE_LIMITED with retry_after_seconds DETAIL jsonb.

Responsibilities:
- Read limit from platform_constant_int message_rate key

Implementation Details:
- ON CONFLICT increment
- RAISE SQLSTATE P0001

Deliverables:
- SQL function

Dependencies:
- Tasks 11, 25

Runtime Guarantees:
- 429 mappable at PostgREST layer

Failure Handling:
- Window boundary edge cases use floor to minute

Observability:
- rate limit counter

Security Considerations:
- Per participant only

Performance Considerations:
- Minimal writes one row/minute max

Requirements covered:
3, 31

Acceptance Criteria covered:
R3-AC11, R30-AC06

## 27. [x] Implement cns_has_bilateral_reciprocity function

Description:
EXISTS client and provider messages types text|image|proposal in window per design §4.6.

Responsibilities:
- Exclude system and workflow_action
- Use chats.reciprocity_window_hours constant

Implementation Details:
- Parameterized chat_id and window_hours

Deliverables:
- SQL function
- pgTAP bilateral/unilateral fixtures

Dependencies:
- Tasks 4, 10

Runtime Guarantees:
- Deterministic given message history

Failure Handling:
- None

Observability:
- Used by reciprocity batch metrics

Security Considerations:
- No auth — called from SECURITY DEFINER cron

Performance Considerations:
- Index chat_messages conversation_created

Requirements covered:
4, 25

Acceptance Criteria covered:
R4-AC03, R4-AC04, R25-AC01

## 28. [x] Implement cns_send_message RPC

Description:
Primary message ingress: first-message chat creation, slot check §3.3.1, reactivation without slot, free messaging gate, rate limit, outbox CHAT_MESSAGE_SENT per design §4.1-4.2.

Responsibilities:
- Lock SR FOR UPDATE on new conversation path
- Lock stats FOR UPDATE for new pair slot admission
- INACTIVE→ACTIVE without slot check/increment
- Insert domain_events for text/image

Implementation Details:
- Full sequence §4.1
- Error codes: NO_ACTIVE_SLOT, SR_NOT_OPEN, CONVERSATION_CLOSED, FREE_MESSAGING_DISABLED_PROPOSAL_PENDING, RATE_LIMITED

Deliverables:
- SQL RPC
- pgTAP suite tasks 100-103 subset

Dependencies:
- Tasks 2-4, 3, 23-26, 25

Runtime Guarantees:
- Commit-before-200 (OAC-02)
- Idempotent message triple
- Slot +1 only new pair ACTIVE

Failure Handling:
- 409/422 business errors no partial insert

Observability:
- cns_send_message_duration_ms
- cns_slot_rejection_total

Security Considerations:
- Participant only; not admin write (R35-AC14)

Performance Considerations:
- p95 <500ms excl upload

Requirements covered:
1, 3, 4, 29, 34

Acceptance Criteria covered:
R1-AC01, R1-AC02, R1-AC03, R3-AC01, R3-AC02, R3-AC03, R3-AC04, R3-AC09, R4-AC01, R4-AC07, R29-AC01, R32-AC01, OAC-02, OAC-12, OAC-13

## 29. [x] Implement cns_initiate_conversation RPC (optional standalone)

Description:
Provider-only explicit chat creation if not folded into cns_send_message; same slot semantics §3.3.1.

Responsibilities:
- MAY remain thin wrapper calling shared internal _cns_ensure_conversation
- Idempotency required

Implementation Details:
- Return existing conversation if pair exists

Deliverables:
- SQL RPC optional

Dependencies:
- Tasks 26, 3

Runtime Guarantees:
- Same slot rules as first message path

Failure Handling:
- Duplicate returns 200 existing

Observability:
- Initiate counter optional

Security Considerations:
- Provider role check

Performance Considerations:
- Single SR stats lock

Requirements covered:
1, 4, 29

Acceptance Criteria covered:
R1-AC01, R4-AC07, R29-AC03

## 30. [x] Implement submit_proposal RPC

Description:
Provider proposal submission: validate pricing_signature, no concurrent PENDING, insert proposal+timeline message, PROPOSAL_SUBMITTED event per design §4.3.

Responsibilities:
- Lock conversation+SR
- Partial unique prevents second PENDING
- Insert message_type proposal linked_entity
- Disable free chat via PENDING existence

Implementation Details:
- Revision path increments version/revision_count
- Validate 1-3 suggested slots

Deliverables:
- SQL RPC
- pgTAP submit tests

Dependencies:
- Tasks 14, 23-24, 26 helpers

Runtime Guarantees:
- Single TX: proposal+message+event (R32-AC03)
- Idempotent via rpc_idempotency_records

Failure Handling:
- Second PENDING → 409
- Invalid pricing → 422

Observability:
- proposal_submitted analytics hook via outbox

Security Considerations:
- Provider participant only

Performance Considerations:
- Lock conversation row

Requirements covered:
6, 10, 34

Acceptance Criteria covered:
R6-AC01, R6-AC02, R6-AC05, R6-AC08, R10-AC03, R10-AC08, R10-AC10, R34-AC06, R34-AC13, R32-AC03

## 31. [x] Implement accept_proposal RPC

Description:
Atomic accept cascade per design §4.4 and Appendix A: ACCEPTED, SR COMPLETED, bulk CLOSED, REJECTED_AUTOMATICALLY, services insert, stats=0, bulk domain events.

Responsibilities:
- FOR UPDATE SR and all SR proposals
- Validate PENDING and SLA not expired
- selected_slot required
- Insert services then optional contracted_service_id FK update

Implementation Details:
- Pseudocode Appendix A
- Error PROPOSAL_EXPIRED, SR_NOT_OPEN, SR_ALREADY_COMPLETED

Deliverables:
- SQL RPC
- pgTAP accept concurrency test

Dependencies:
- Tasks 6, 8, 14, 23-24, 13

Runtime Guarantees:
- Single TX no partial close (R26-AC03, OAC-11)
- Concurrent second accept 409 (R7-AC03)

Failure Handling:
- Any step failure full rollback

Observability:
- accept_proposal_total
- Audit rows

Security Considerations:
- Client SR owner only (R31-AC03)

Performance Considerations:
- p95 <3s

Requirements covered:
2, 7, 14, 23

Acceptance Criteria covered:
R7-AC01, R7-AC02, R7-AC03, R7-AC05, R7-AC06, R7-AC07, R2-AC04, R23-AC01, R23-AC03, R32-AC02, OAC-03, OAC-11, OAC-16

## 32. [x] Implement reject_proposal RPC

Description:
Client reject PENDING→REJECTED; emit PROPOSAL_REJECTED; free messaging re-enabled per Req. 34.

Responsibilities:
- Set rejected_at
- workflow_action message optional

Implementation Details:
- Domain event for MMD

Deliverables:
- SQL RPC

Dependencies:
- Tasks 14, 23, 25

Runtime Guarantees:
- Status conditional UPDATE WHERE PENDING

Failure Handling:
- Not PENDING → 409

Observability:
- Reject counter

Security Considerations:
- Client owner validation

Performance Considerations:
- Single proposal row lock

Requirements covered:
8, 34

Acceptance Criteria covered:
R8-AC01, R8-AC02, R34-AC08

## 33. [x] Implement request_proposal_revision RPC

Description:
Client revision request PENDING→REVISION_REQUESTED with reason enum; revision_count unchanged until resubmit; free chat enabled.

Responsibilities:
- Reject if revision_count>=2 REVISION_LIMIT_EXCEEDED
- Persist revision_reason and notes

Implementation Details:
- PROPOSAL_REVISION_REQUESTED event

Deliverables:
- SQL RPC

Dependencies:
- Tasks 14, 23, 25

Runtime Guarantees:
- Free messaging allowed after commit (R34-AC04)

Failure Handling:
- Limit exceeded 409

Observability:
- Revision requested metric

Security Considerations:
- Client only

Performance Considerations:
- Lock proposal row

Requirements covered:
10, 34

Acceptance Criteria covered:
R10-AC01, R10-AC02, R10-AC05, R10-AC06, R34-AC04, R34-AC05

## 34. [x] Implement decline_revision_request RPC

Description:
Provider declines revision: REVISION_REQUESTED→PENDING; free messaging remains disabled per design §4.5.

Responsibilities:
- Provider participant check
- Transition REVISION_REQUESTED→PENDING
- Emit workflow_action if configured

Implementation Details:
- Validate proposal status REVISION_REQUESTED
- Persist decline in proposal_audit metadata

Deliverables:
- SQL RPC

Dependencies:
- Tasks 14, 25

Runtime Guarantees:
- Returns to proposal-only channel (R34-AC07)

Failure Handling:
- Invalid state → 409

Observability:
- Decline metric

Security Considerations:
- Provider only

Performance Considerations:
- Single row update

Requirements covered:
10, 34

Acceptance Criteria covered:
R10-AC04, R10-AC09, R34-AC07

## 35. [x] Implement cns_close_conversation RPC

Description:
Manual close with confirmation token; CLOSED irreversible; MANUAL closure_type; slot decrement if was ACTIVE §4.8.

Responsibilities:
- Require p_confirm=true token
- Set closed_by_user_id, closure_reason optional

Implementation Details:
- CONVERSATION_CLOSED event

Deliverables:
- SQL RPC

Dependencies:
- Tasks 2, 3, 23, 24

Runtime Guarantees:
- Slot -1 if ACTIVE (R11-AC03)
- No reactivation (R11-AC02)

Failure Handling:
- Already CLOSED → 409

Observability:
- Closure audit

Security Considerations:
- Participant either role

Performance Considerations:
- Lock conversation row

Requirements covered:
11, 4

Acceptance Criteria covered:
R11-AC01, R11-AC02, R11-AC03, R11-AC04

## 36. [x] Implement cancel_service_request RPC

Description:
Client cancel SR: CANCELLED, all chats CLOSED, proposals terminal REJECTED_AUTOMATICALLY; competes with accept via SR FOR UPDATE §4.4.

Responsibilities:
- SR lock FOR UPDATE
- NEGOTIATION_TERMINATED event optional
- CHATS_CLOSED_BULK event

Implementation Details:
- Normative reference: design.md — task 36: `Implement cancel_service_request RPC`.
- Scope: Client cancel SR: CANCELLED, all chats CLOSED, proposals terminal REJECTED_AUTOMATICALLY; competes with accept via SR FOR UPDATE §4.4.
- Execute: SR lock FOR UPDATE
- Execute: NEGOTIATION_TERMINATED event optional
- Execute: CHATS_CLOSED_BULK event
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC

Dependencies:
- Tasks 13, 23-24, 3

Runtime Guarantees:
- Atomic cancel (OAC-11)
- vs accept one wins 409 (R2-AC06)

Failure Handling:
- Partial cancel impossible

Observability:
- Cancel audit trail

Security Considerations:
- Client SR owner only

Performance Considerations:
- Bulk update by service_request_id index

Requirements covered:
2, 11

Acceptance Criteria covered:
R2-AC05, R2-AC06, R2-AC07, OAC-11

## 37. [x] Implement cns_mark_conversation_read RPC

Description:
Upsert chat_read_receipts; return last_read_at per design §5.1.

Responsibilities:
- Optional last_read_message_id validation belongs to conversation

Implementation Details:
- Normative reference: design.md — task 37: `Implement cns_mark_conversation_read RPC`.
- Scope: Upsert chat_read_receipts; return last_read_at per design §5.1.
- Execute: Optional last_read_message_id validation belongs to conversation
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC

Dependencies:
- Task 5

Runtime Guarantees:
- Upsert idempotent

Failure Handling:
- Invalid message id → 422

Observability:
- Unread badge clears

Security Considerations:
- Participant only

Performance Considerations:
- Single upsert

Requirements covered:
3, 17

Acceptance Criteria covered:
R3-AC10, R17-AC04

# Phase 4: Scheduling Engine

## 38. [ ] Implement cns_evaluate_reciprocity_batch RPC

Description:
Cron batch: SKIP LOCKED ACTIVE chats past window pre-filter; bilateral check; INACTIVE+slot-1+events per design §4.6.

Responsibilities:
- Batch size 500 default
- Per-row savepoint on failure (R25-AC04)
- Skip SR COMPLETED/CANCELLED (R25-AC07)

Implementation Details:
- Schedule */10 * * * *
- Emit SLOT_RELEASED and CONVERSATION_INACTIVATED

Deliverables:
- SQL RPC
- pgTAP reciprocity tests

Dependencies:
- Tasks 25, 28, 3, 12

Runtime Guarantees:
- Conditional UPDATE WHERE ACTIVE (R14-AC04)
- At-least-once job safe

Failure Handling:
- Savepoint isolates row failures

Observability:
- cns_reciprocity_transitions_total
- job_runs row

Security Considerations:
- SECURITY DEFINER service role cron

Performance Considerations:
- Completes scan <15min at 10^5 chats (R25-AC06)

Requirements covered:
4, 25

Acceptance Criteria covered:
R4-AC02, R4-AC03, R4-AC04, R25-AC01, R25-AC04, R25-AC06, R25-AC07, R14-AC04

## 39. [ ] Implement cns_expire_pending_proposals RPC

Description:
Batch expire PENDING where submitted_at+SLA<now using platform_constant_int proposal_response_sla_hours §4.7.

Responsibilities:
- Batch 500
- Set expired_at
- Optional conversation INACTIVE if no recent activity
- PROPOSAL_EXPIRED events

Implementation Details:
- Schedule */10 * * * *

Deliverables:
- SQL RPC
- pgTAP expiry tests

Dependencies:
- Tasks 10, 28, 14

Runtime Guarantees:
- WHERE status=PENDING conditional (R25-AC02)
- Free chat after expire if not CLOSED (R9-AC03)

Failure Handling:
- Per-row savepoint

Observability:
- cns_proposal_expiry_lag_seconds gauge
- job_runs

Security Considerations:
- Cron SECURITY DEFINER

Performance Considerations:
- Index on (status, submitted_at) partial PENDING

Requirements covered:
9, 25, 33

Acceptance Criteria covered:
R9-AC01, R9-AC03, R9-AC04, R9-AC05, R25-AC02, R25-AC03, R25-AC08

## 40. [ ] Register pg_cron jobs for reciprocity and proposal expiry

Description:
Wire */10 cron invocations to batch RPCs with job_runs wrapper per design §6.1.

Responsibilities:
- Grant execute to postgres/cron role
- Log started_at/finished_at

Implementation Details:
- Normative reference: design.md — task 40: `Register pg_cron jobs for reciprocity and proposal expiry`.
- Scope: Wire */10 cron invocations to batch RPCs with job_runs wrapper per design §6.1.
- Execute: Grant execute to postgres/cron role
- Execute: Log started_at/finished_at
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- cron.schedule migrations
- Wrapper functions inserting job_runs

Dependencies:
- Tasks 38, 39, 12

Runtime Guarantees:
- Jobs idempotent re-register on migration

Failure Handling:
- Cron failure retries next slot

Observability:
- job_runs dashboard

Security Considerations:
- No public execute grant

Performance Considerations:
- Two jobs every 10min — acceptable load

Requirements covered:
25

Acceptance Criteria covered:
R25-AC01, R25-AC02, R25-AC05, OAC-06

## 41. [ ] Implement slot accounting integration tests in SQL

Description:
pgTAP tests proving §3.3.1 matrix: new +1, reactivate 0, INACTIVE -1, accept reset 0.

Responsibilities:
- Concurrent two-provider last slot race
- Reactivation when at limit allowed

Implementation Details:
- supabase/tests/chats/slot_accounting_test.sql

Deliverables:
- Test SQL

Dependencies:
- Tasks 26, 38, 3

Runtime Guarantees:
- Document expected temporary ACTIVE>limit

Failure Handling:
- Failed test blocks merge

Observability:
- CI pgTAP job

Security Considerations:
- Uses test roles

Performance Considerations:
- Minimal fixtures

Requirements covered:
4, 33

Acceptance Criteria covered:
R4-AC01, R4-AC06, R4-AC09, R33-AC07, R32-AC04

# Phase 5: Eventing & Async Coordination

## 42. [ ] Implement cns_mmd_ingest SECURITY DEFINER wrapper

Description:
Calls message_dispatcher.message_dispatcher_ingest with service_role; maps event types to templates/channels/bypass_limits per design §4.10.

Responsibilities:
- Chat message: push only bypass_limits=true
- Proposal lifecycle: push+email bypass_limits=false
- Stable idempotency_key from payload

Implementation Details:
- Normative reference: design.md — task 42: `Implement cns_mmd_ingest SECURITY DEFINER wrapper`.
- Scope: Calls message_dispatcher.message_dispatcher_ingest with service_role; maps event types to templates/channels/bypass_limits per design §4.10.
- Execute: Chat message: push only bypass_limits=true
- Execute: Proposal lifecycle: push+email bypass_limits=false
- Execute: Stable idempotency_key from payload
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL wrapper function

Dependencies:
- Task 7
- MMD schema

Runtime Guarantees:
- MMD failure does not rollback caller (G5)

Failure Handling:
- Log NOTIFICATION_SKIPPED on failure (R30-AC02)

Observability:
- Ingest latency metric

Security Considerations:
- Service role only

Performance Considerations:
- Batch ingest from consumer

Requirements covered:
12, 28, 30

Acceptance Criteria covered:
R12-AC01, R12-AC02, R12-AC03, R12-AC04, R30-AC02, OAC-09

## 43. [ ] Implement cns_enqueue_notifications domain event consumer

Description:
Consumer handler routing domain_events to cns_mmd_ingest with template selection per event_type.

Responsibilities:
- Map CHAT_MESSAGE_SENT, PROPOSAL_*, CONVERSATION_*
- Include deep_link_path /chats/{id}

Implementation Details:
- Normative reference: design.md — task 43: `Implement cns_enqueue_notifications domain event consumer`.
- Scope: Consumer handler routing domain_events to cns_mmd_ingest with template selection per event_type.
- Execute: Map CHAT_MESSAGE_SENT, PROPOSAL_*, CONVERSATION_*
- Execute: Include deep_link_path /chats/{id}
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL function called from processor

Dependencies:
- Tasks 42 wrapper, 44

Runtime Guarantees:
- At-least-once with MMD dedupe

Failure Handling:
- Skip gracefully on template missing

Observability:
- Notification enqueue count

Security Considerations:
- No PII in logs

Performance Considerations:
- One ingest per event

Requirements covered:
12, 28

Acceptance Criteria covered:
R12-AC01, R12-AC03, R12-AC06, R7-AC05

## 44. [ ] Implement cns_emit_analytics domain event consumer

Description:
Best-effort analytics fan-out; failure MUST NOT block processed_at for notification handler (R28-AC03).

Responsibilities:
- Separate subhandler or savepoint isolated
- Emit structured metadata for product analytics

Implementation Details:
- Normative reference: design.md — task 44: `Implement cns_emit_analytics domain event consumer`.
- Scope: Best-effort analytics fan-out; failure MUST NOT block processed_at for notification handler (R28-AC03).
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Separate subhandler or savepoint isolated
- Execute: Emit structured metadata for product analytics
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL function

Dependencies:
- Task 44 processor

Runtime Guarantees:
- Analytics failure optional

Failure Handling:
- Log and continue

Observability:
- Analytics lag metric

Security Considerations:
- Scrub message content

Performance Considerations:
- Async batch

Requirements covered:
21, 28

Acceptance Criteria covered:
R21-AC03, R28-AC03

## 45. [ ] Implement cns_process_domain_events batch processor

Description:
Checkout with SKIP LOCKED, locked_until 30s, invoke enqueue+analytics, set processed_at or retry/dead_letter §6.2.

Responsibilities:
- Batch 100
- max_retries 5 exponential backoff
- dead_letter flag without processed_at §8.4

Implementation Details:
- Normative reference: design.md — task 45: `Implement cns_process_domain_events batch processor`.
- Scope: Checkout with SKIP LOCKED, locked_until 30s, invoke enqueue+analytics, set processed_at or retry/dead_letter §6.2.
- Execute: Batch 100
- Execute: max_retries 5 exponential backoff
- Execute: dead_letter flag without processed_at §8.4
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC
- Checkout pattern §6.2

Dependencies:
- Tasks 7, 43-45

Runtime Guarantees:
- Exactly-once side effects via MMD keys
- At-least-once delivery

Failure Handling:
- Stale lease reclaimed Task 47

Observability:
- cns_domain_events_backlog
- dead_letter counter

Security Considerations:
- Cron/service_role only

Performance Considerations:
- 1 min cron throughput

Requirements covered:
28, 27

Acceptance Criteria covered:
R28-AC01, R28-AC02, R28-AC05, R28-AC06, OAC-09

## 46. [ ] Implement proposal.expiring_soon reminder enqueue in consumer

Description:
When PENDING and submitted_at+SLA-4h<now<SLA enqueue MMD template proposal.expiring_soon bypass_limits=false §4.12.

Responsibilities:
- SHOULD not duplicate reminders — idempotency_key per proposal
- Runs in domain consumer or scheduled scan

Implementation Details:
- Normative reference: design.md — task 46: `Implement proposal.expiring_soon reminder enqueue in consumer`.
- Scope: When PENDING and submitted_at+SLA-4h<now<SLA enqueue MMD template proposal.expiring_soon bypass_limits=false §4.12.
- Execute: SHOULD not duplicate reminders — idempotency_key per proposal
- Execute: Runs in domain consumer or scheduled scan
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Consumer branch or auxiliary RPC

Dependencies:
- Tasks 44, 22 templates

Runtime Guarantees:
- At-most-once reminder per proposal window

Failure Handling:
- Skip if already sent

Observability:
- Reminder sent counter

Security Considerations:
- Participant targeting via MMD

Performance Considerations:
- Small batch scan

Requirements covered:
9, 12

Acceptance Criteria covered:
R9-AC07, R12-AC03

# Phase 6: Distributed Workers & Janitors

## 47. [ ] Implement cns_release_stale_leases RPC

Description:
Clear locked_until on domain_events (and optional maintenance queue) where lease expired; run before each checkout §6.4.

Responsibilities:
- Also reset orphaned locked_by
- Invoked at start of cns_process_domain_events

Implementation Details:
- Normative reference: design.md — task 47: `Implement cns_release_stale_leases RPC`.
- Scope: Clear locked_until on domain_events where lease expired; run before each checkout §6.4.
- Execute: Also reset orphaned locked_by
- Execute: Invoked at start of cns_process_domain_events
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL function

Dependencies:
- Task 7

Runtime Guarantees:
- Makes rows eligible for reclaim (R27-AC02)

Failure Handling:
- Idempotent update

Observability:
- Stale lease alert

Security Considerations:
- Cron only

Performance Considerations:
- Index domain_events_stale_lease_idx

Requirements covered:
27, 28

Acceptance Criteria covered:
R27-AC02, OAC-07

## 48. [ ] Register pg_cron domain events processor job

Description:
Schedule * * * * * invoking cns_process_domain_events with job_runs telemetry §6.1.

Responsibilities:
- 1 minute interval
- Calls release_stale_leases first

Implementation Details:
- Normative reference: design.md — task 48: `Register pg_cron domain events processor job`.
- Scope: Schedule * * * * * invoking cns_process_domain_events with job_runs telemetry §6.1.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: 1 minute interval
- Execute: Calls release_stale_leases first
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- cron.schedule migration

Dependencies:
- Tasks 44, 47

Runtime Guarantees:
- Continuous drain of outbox

Failure Handling:
- Missed minute catches up next run

Observability:
- Backlog gauge alert >1000

Security Considerations:
- Restricted execute

Performance Considerations:
- 100 events/min baseline

Requirements covered:
28, 25

Acceptance Criteria covered:
R28-AC02, OAC-06

## 49. [ ] Implement cns_janitor_orphan_media RPC

Description:
Delete Storage objects for chat_media_upload_sessions pending with expires_at<now()-24h; mark expired §5.2.

Responsibilities:
- Daily 0 3 * * *
- SLO orphan removed within 48h

Implementation Details:
- Normative reference: design.md — task 49: `Implement cns_janitor_orphan_media RPC`.
- Scope: Delete Storage objects for chat_media_upload_sessions pending with expires_at<now()-24h; mark expired §5.2.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Daily 0 3 * * *
- Execute: SLO orphan removed within 48h
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC + storage list/delete via Edge or pg_net if needed
- Prefer Edge batch trigger calling RPC mark

Dependencies:
- Task 15 sessions table

Runtime Guarantees:
- Storage delete best-effort

Failure Handling:
- Log delete failures per session

Observability:
- Orphan bytes metric

Security Considerations:
- Service role Storage access

Performance Considerations:
- Daily batch

Requirements covered:
26

Acceptance Criteria covered:
R26-AC02, R3-AC06

## 50. [ ] Register pg_cron orphan media janitor

Description:
Cron 0 3 * * * calling cns_janitor_orphan_media.

Responsibilities:
- job_runs wrapper

Implementation Details:
- Normative reference: design.md — task 50: `Register pg_cron orphan media janitor`.
- Scope: Cron 0 3 * * * calling cns_janitor_orphan_media.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: job_runs wrapper
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- cron migration

Dependencies:
- Task 49

Runtime Guarantees:
- Daily cleanup

Failure Handling:
- Retry next day on failure

Observability:
- job_runs entry

Security Considerations:
- Cron role only

Performance Considerations:
- Off-peak schedule

Requirements covered:
26

Acceptance Criteria covered:
R26-AC02

## 51. [ ] Implement cns_reconcile_pending_deliveries RPC

Description:
Optional batch 200: mark stale delivery_status pending messages failed after 5min §8.1.

Responsibilities:
- Schedule */5 * * * * optional
- MUST NOT duplicate visible messages

Implementation Details:
- Normative reference: design.md — task 51: `Implement cns_reconcile_pending_deliveries RPC`.
- Scope: Optional batch 200: mark stale delivery_status pending messages failed after 5min §8.1.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Schedule */5 * * * * optional
- Execute: MUST NOT duplicate visible messages
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC

Dependencies:
- Task 4 messages

Runtime Guarantees:
- Reconcile not resend

Failure Handling:
- Idempotent status update

Observability:
- Reconcile count metric

Security Considerations:
- Participant context not required

Performance Considerations:
- Partial index on delivery_status pending

Requirements covered:
26, 13

Acceptance Criteria covered:
R26-AC01, R13-AC03

## 52. [ ] Register pg_cron delivery reconcile job

Description:
Optional */5 cron for cns_reconcile_pending_deliveries.

Responsibilities:
- Feature flag ENABLE_DELIVERY_RECONCILE

Implementation Details:
- Normative reference: design.md — task 52: `Register pg_cron delivery reconcile job`.
- Scope: Optional */5 cron for cns_reconcile_pending_deliveries.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Feature flag ENABLE_DELIVERY_RECONCILE
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- cron migration

Dependencies:
- Task 51

Runtime Guarantees:
- Periodic reconciliation

Failure Handling:
- Skip if disabled

Observability:
- job_runs

Security Considerations:
- Cron only

Performance Considerations:
- 200 rows per 5min

Requirements covered:
26

Acceptance Criteria covered:
R26-AC01

# Phase 7: Edge Functions & Media APIs

## 53. [ ] Implement cns_validate_upload_session RPC

Description:
Validate upload session belongs to auth.uid participant; session pending and not expired §5.2.

Responsibilities:
- Called from chat-upload-media Edge before Storage put

Implementation Details:
- Normative reference: design.md — task 53: `Implement cns_validate_upload_session RPC`.
- Scope: Validate upload session belongs to auth.uid participant; session pending and not expired §5.2.
- Execute: Called from chat-upload-media Edge before Storage put
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC

Dependencies:
- Task 15

Runtime Guarantees:
- Reject expired/foreign sessions

Failure Handling:
- 403 on mismatch

Observability:
- Upload validation counter

Security Considerations:
- Participant match

Performance Considerations:
- Single row lookup

Requirements covered:
3, 31

Acceptance Criteria covered:
R3-AC06, R31-AC01

## 54. [ ] Implement chat-upload-media Edge Function

Description:
Multipart upload: JWT, validate session RPC, magic-byte check, Storage put, return paths §5.2.

Responsibilities:
- Max 5 images x 5MB
- Timeout <30s
- Stateless — no conversation cache (OAC-17)

Implementation Details:
- Normative reference: design.md — task 54: `Implement chat-upload-media Edge Function`.
- Scope: Multipart upload: JWT, validate session RPC, magic-byte check, Storage put, return paths §5.2.
- Execute: Max 5 images x 5MB
- Execute: Timeout <30s
- Execute: Stateless — no conversation cache (OAC-17)
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- supabase/functions/chat-upload-media/index.ts
- Deno tests Task 105

Dependencies:
- Tasks 53, 15

Runtime Guarantees:
- Two-phase: upload then cns_send_message

Failure Handling:
- Client retry capped 3

Observability:
- Structured logs correlation_id

Security Considerations:
- JWT required
- Rate limit checkRateLimit

Performance Considerations:
- Streaming multipart

Requirements covered:
3, 26

Acceptance Criteria covered:
R3-AC06, R26-AC06, R30-AC04, OAC-17

## 55. [ ] Implement cns_attach_message_media RPC (if used)

Description:
Optional RPC to bind uploaded paths to pending message — design references attach path; MAY be folded into cns_send_message payload only.

Responsibilities:
- If implemented: mark session completed
- Validate paths belong to session

Implementation Details:
- Normative reference: design.md — task 55: `Implement cns_attach_message_media RPC (if used)`.
- Scope: Optional RPC to bind uploaded paths to pending message — design references attach path; MAY be folded into cns_send_message payload only.
- Execute: If implemented: mark session completed
- Execute: Validate paths belong to session
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC optional

Dependencies:
- Tasks 53, 26

Runtime Guarantees:
- Session completed atomically with message insert

Failure Handling:
- Orphan if only upload succeeds

Observability:
- Attach counter

Security Considerations:
- Participant validation

Performance Considerations:
- Minimal updates

Requirements covered:
3

Acceptance Criteria covered:
R3-AC06, R26-AC02

## 56. [ ] Implement cns_refresh_media_signed_urls RPC

Description:
Re-sign expired Storage URLs for participant message payloads §5.1.

Responsibilities:
- Input message ids or paths
- Return refreshed signed URLs

Implementation Details:
- Normative reference: design.md — task 56: `Implement cns_refresh_media_signed_urls RPC`.
- Scope: Re-sign expired Storage URLs for participant message payloads §5.1.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Input message ids or paths
- Execute: Return refreshed signed URLs
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC using storage.sign or Edge delegation

Dependencies:
- Tasks 4, 15

Runtime Guarantees:
- 403 if URL refresh unauthorized

Failure Handling:
- Expired URL error mapping

Observability:
- Refresh counter

Security Considerations:
- Participant only (R31-AC06)

Performance Considerations:
- Batch limit 20 paths

Requirements covered:
31

Acceptance Criteria covered:
R31-AC06

## 57. [ ] Delegate legacy create_provider_proposal to submit_proposal

Description:
Wave D cutover: legacy RPC wraps submit_proposal internally per design §Schema evolution.

Responsibilities:
- Maintain backward compat during migration
- Log deprecation warning

Implementation Details:
- Normative reference: design.md — task 57: `Delegate legacy create_provider_proposal to submit_proposal`.
- Scope: Wave D cutover: legacy RPC wraps submit_proposal internally per design §Schema evolution.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Maintain backward compat during migration
- Execute: Log deprecation warning
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL replace function body

Dependencies:
- Task 28

Runtime Guarantees:
- Same semantics as direct submit

Failure Handling:
- Legacy clients unaffected until UI cutover

Observability:
- Deprecation metric

Security Considerations:
- Same auth as submit

Performance Considerations:
- Single delegate call

Requirements covered:
6

Acceptance Criteria covered:
R6-AC01, R6-AC07

# Phase 8: Read APIs & Query RPCs

## 58. [ ] Implement list_conversations RPC

Description:
Paginated inbox last_interaction_at DESC page 20 max 100; lateral last message preview; unread flag §5.1 §9.2.

Responsibilities:
- Project minimal columns JSON <1MB (R22-AC04)
- Filter by auth participant

Implementation Details:
- Normative reference: design.md — task 58: `Implement list_conversations RPC`.
- Scope: Paginated inbox last_interaction_at DESC page 20 max 100; lateral last message preview; unread flag §5.1 §9.2.
- Execute: Project minimal columns JSON <1MB (R22-AC04)
- Execute: Filter by auth participant
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC
- Index chats_last_interaction

Dependencies:
- Tasks 2, 5, 25

Runtime Guarantees:
- Stable pagination cursor

Failure Handling:
- Empty page for non-participant

Observability:
- p95 <500ms

Security Considerations:
- RLS + RPC definer read

Performance Considerations:
- Lateral join limit 1

Requirements covered:
17, 22

Acceptance Criteria covered:
R17-AC01, R17-AC02, R17-AC03, R17-AC04, R22-AC01, R22-AC04

## 59. [ ] Implement list_chat_messages RPC

Description:
Keyset pagination (created_at, id) DESC query ASC display; cursor params §3.4.

Responsibilities:
- Enforce limit max 100 default 20
- Participant check

Implementation Details:
- Normative reference: design.md — task 59: `Implement list_chat_messages RPC`.
- Scope: Keyset pagination (created_at, id) DESC query ASC display; cursor params §3.4.
- Execute: Enforce limit max 100 default 20
- Execute: Participant check
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC

Dependencies:
- Task 4

Runtime Guarantees:
- Consistent cursor no duplicates

Failure Handling:
- Out-of-range cursor → empty

Observability:
- p95 <500ms

Security Considerations:
- Participant via RLS

Performance Considerations:
- Uses conversation_created_idx

Requirements covered:
3, 13, 22

Acceptance Criteria covered:
R3-AC08, R13-AC04, R22-AC01, R22-AC03

## 60. [ ] Implement get_conversation_detail RPC

Description:
Header panel: masked address, category, SR photos §4.15.

Responsibilities:
- Join service_requests
- Mask PII per business rules

Implementation Details:
- Normative reference: design.md — task 60: `Implement get_conversation_detail RPC`.
- Scope: Header panel: masked address, category, SR photos §4.15.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Join service_requests
- Execute: Mask PII per business rules
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC

Dependencies:
- Tasks 2, 13

Runtime Guarantees:
- Read-only snapshot

Failure Handling:
- 404 non-participant

Observability:
- Detail fetch latency

Security Considerations:
- No full address leak

Performance Considerations:
- Single SR join

Requirements covered:
5, 18

Acceptance Criteria covered:
R5-AC02, R18-AC02

## 61. [ ] Implement get_proposal_for_timeline RPC

Description:
Hydrate DynamicProposalCard from linked_entity_id; full proposal projection §5.1.

Responsibilities:
- Lazy load on expand (R22-AC05)
- Include suggested slots and status

Implementation Details:
- Normative reference: design.md — task 61: `Implement get_proposal_for_timeline RPC`.
- Scope: Hydrate DynamicProposalCard from linked_entity_id; full proposal projection §5.1.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Lazy load on expand (R22-AC05)
- Execute: Include suggested slots and status
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC

Dependencies:
- Task 14

Runtime Guarantees:
- Authoritative pricing from proposals table

Failure Handling:
- 404 if not participant

Observability:
- Hydration latency

Security Considerations:
- Participant read

Performance Considerations:
- Single proposal PK

Requirements covered:
16, 22

Acceptance Criteria covered:
R16-AC01, R16-AC07, R22-AC05

## 62. [ ] Implement list_proposal_versions RPC

Description:
All provider_proposals rows for conversation ordered by version §4.14.

Responsibilities:
- Include REVISED/REJECTED/EXPIRED for compare UI

Implementation Details:
- Normative reference: design.md — task 62: `Implement list_proposal_versions RPC`.
- Scope: All provider_proposals rows for conversation ordered by version §4.14.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Include REVISED/REJECTED/EXPIRED for compare UI
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC

Dependencies:
- Task 14

Runtime Guarantees:
- Read-only history

Failure Handling:
- Non-participant deny

Observability:
- Version list size bounded

Security Considerations:
- Participant read

Performance Considerations:
- Index chat_id

Requirements covered:
10, 16

Acceptance Criteria covered:
R10-AC11, R10-AC12, R5-AC05

# Phase 9: Observability & Auditability

## 63. [ ] Implement audit replay support query for operations

Description:
Support query joining chat_audit and proposal_audit by service_request_id ordered created_at §10.4.

Responsibilities:
- MAY expose admin-only RPC get_negotiation_audit_timeline
- Used by support tooling

Implementation Details:
- Normative reference: design.md — task 63: `Implement audit replay support query for operations`.
- Scope: Support query joining chat_audit and proposal_audit by service_request_id ordered created_at §10.4.
- Execute: MAY expose admin-only RPC get_negotiation_audit_timeline
- Execute: Used by support tooling
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL view or RPC

Dependencies:
- Task 9

Runtime Guarantees:
- Immutable ordering

Failure Handling:
- Read-only

Observability:
- Support dashboard

Security Considerations:
- Admin role only

Performance Considerations:
- Index-backed sort

Requirements covered:
21

Acceptance Criteria covered:
R21-AC04, R28-AC06

## 64. [ ] Instrument cron wrappers with job_runs logging

Description:
All pg_cron entrypoints insert/update job_runs with counts and duration §3.15.

Responsibilities:
- Standard metadata jsonb job_version
- Error stack sanitized

Implementation Details:
- Normative reference: design.md — task 64: `Instrument cron wrappers with job_runs logging`.
- Scope: All pg_cron entrypoints insert/update job_runs with counts and duration §3.15.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Standard metadata jsonb job_version
- Execute: Error stack sanitized
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL wrapper functions

Dependencies:
- Task 12

Runtime Guarantees:
- Every invocation recorded (R25-AC05)

Failure Handling:
- Partial completion reflected in error_count

Observability:
- Ops alert on error_count spike

Security Considerations:
- Service role

Performance Considerations:
- Minimal overhead

Requirements covered:
25, 21

Acceptance Criteria covered:
R25-AC05, R21-AC05

## 65. [ ] Configure Edge structured logging for chat-upload-media

Description:
Fields: correlation_id, conversation_id, upload_session_id, idempotency_key §10.1.

Responsibilities:
- logger integration
- Sentry Deno optional

Implementation Details:
- Normative reference: design.md — task 65: `Configure Edge structured logging for chat-upload-media`.
- Scope: Fields: correlation_id, conversation_id, upload_session_id, idempotency_key §10.1.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: logger integration
- Execute: Sentry Deno optional
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Edge function logging

Dependencies:
- Task 54

Runtime Guarantees:
- Traceable upload failures

Failure Handling:
- Scrub file content from logs

Observability:
- Cloud logs query

Security Considerations:
- No JWT in logs

Performance Considerations:
- N/A

Requirements covered:
21, 26

Acceptance Criteria covered:
R21-AC02, R26-AC06

## 66. [ ] Configure frontend Sentry scrubbing for chats feature

Description:
Tags feature=chats, chat_id, service_request_id; scrub payload.text §10.2.

Responsibilities:
- beforeSend scrub message content
- Breadcrumbs exclude PII

Implementation Details:
- Normative reference: design.md — task 66: `Configure frontend Sentry scrubbing for chats feature`.
- Scope: Tags feature=chats, chat_id, service_request_id; scrub payload.text §10.2.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: beforeSend scrub message content
- Execute: Breadcrumbs exclude PII
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- src/lib/sentry config update
- chats hooks setContext

Dependencies:
- None

Runtime Guarantees:
- Errors diagnosable without content leak (R31-AC05)

Failure Handling:
- N/A

Observability:
- Sentry issue grouping

Security Considerations:
- No message body in events

Performance Considerations:
- N/A

Requirements covered:
21, 31

Acceptance Criteria covered:
R21-AC02, R31-AC05

## 67. [ ] Register client analytics events schema v1

Description:
Post-confirm events: negotiation_message_sent, proposal_submitted, proposal_accepted, etc. §10.5.

Responsibilities:
- src/lib/analytics/events.ts schema v1
- Fire only after RPC success

Implementation Details:
- Normative reference: design.md — task 67: `Register client analytics events schema v1`.
- Scope: Post-confirm events: negotiation_message_sent, proposal_submitted, proposal_accepted, etc. §10.5.
- Execute: src/lib/analytics/events.ts schema v1
- Execute: Fire only after RPC success
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- TypeScript schema
- Hook integration points

Dependencies:
- Phase 13 hooks

Runtime Guarantees:
- No optimistic analytics

Failure Handling:
- Drop events on analytics offline

Observability:
- Product dashboard

Security Considerations:
- No PII in event props

Performance Considerations:
- Batch flush

Requirements covered:
21

Acceptance Criteria covered:
R21-AC03

## 68. [ ] Document operational metrics and alert thresholds

Description:
Runbook for cns_* metrics §10.3: backlog, expiry lag, slot rejection, send duration.

Responsibilities:
- Alert p95 send >1s
- backlog >1000
- expiry lag >1800s

Implementation Details:
- docs/ops/cns-metrics.md or section in business docs

Deliverables:
- Metrics catalog

Dependencies:
- Tasks 38-44

Runtime Guarantees:
- On-call actionable thresholds

Failure Handling:
- N/A

Observability:
- Grafana/Dashboard templates

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
21

Acceptance Criteria covered:
R21-AC05

# Phase 10: Recovery & Reliability

## 69. [ ] Implement cns_replay_domain_event RPC

Description:
Admin/service_role reset dead_letter row for reprocessing §8.4.

Responsibilities:
- Reset retry_count, dead_letter flags
- Audit replay actor

Implementation Details:
- Normative reference: design.md — task 69: `Implement cns_replay_domain_event RPC`.
- Scope: Admin/service_role reset dead_letter row for reprocessing §8.4.
- Execute: Reset retry_count, dead_letter flags
- Execute: Audit replay actor
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL RPC grant service_role + admin audit

Dependencies:
- Tasks 44, 7

Runtime Guarantees:
- Replay MUST NOT duplicate MMD if keys stable (R26-AC05)

Failure Handling:
- 404 unknown event id

Observability:
- Replay audit log

Security Considerations:
- Admin audited

Performance Considerations:
- Single row update

Requirements covered:
26, 28

Acceptance Criteria covered:
R26-AC05, R28-AC06

## 70. [ ] Implement dead-letter escalation in cns_process_domain_events

Description:
After max retries set dead_letter=true, dead_letter_at, last_error sanitized §8.4.

Responsibilities:
- MUST NOT set processed_at
- Increment cns_domain_events_dead_letter_total

Implementation Details:
- Normative reference: design.md — task 70: `Implement dead-letter escalation in cns_process_domain_events`.
- Scope: After max retries set dead_letter=true, dead_letter_at, last_error sanitized §8.4.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: MUST NOT set processed_at
- Execute: Increment cns_domain_events_dead_letter_total
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Branch in Task 44 processor

Dependencies:
- Task 44

Runtime Guarantees:
- Poison messages quarantined

Failure Handling:
- Manual replay required

Observability:
- Dead letter alert

Security Considerations:
- Error message sanitized

Performance Considerations:
- Stop hot loop on poison

Requirements covered:
28, 26

Acceptance Criteria covered:
R28-AC02, R26-AC05

## 71. [ ] Document client idempotency retry and PostgREST timeout recovery

Description:
Engineering guide: same idempotency_key on send/accept; poll cached response after timeout §8.1.

Responsibilities:
- TanStack Query mutation retry policy
- Accept MUST NOT optimistic (R30-AC05)

Implementation Details:
- Normative reference: design.md — task 71: `Document client idempotency retry and PostgREST timeout recovery`.
- Scope: Engineering guide: same idempotency_key on send/accept; poll cached response after timeout §8.1.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: TanStack Query mutation retry policy
- Execute: Accept MUST NOT optimistic (R30-AC05)
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Developer doc in feature README

Dependencies:
- Tasks 8, 26, 29

Runtime Guarantees:
- Commit-after-timeout replay safe (OAC-08)

Failure Handling:
- User retry documentation

Observability:
- Timeout rate metric

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
14, 30, 26

Acceptance Criteria covered:
R14-AC01, R27-AC03, R26-AC06, R30-AC05, OAC-08

# Phase 11: Security & Isolation (RLS per table group)

## 72. [ ] Implement RLS policies for chats table

Description:
SELECT admin OR participant; deny INSERT/UPDATE/DELETE for authenticated §11.2.

Responsibilities:
- ENABLE ROW LEVEL SECURITY
- Policies use is_platform_admin OR is_chat_participant

Implementation Details:
- Normative reference: design.md — task 72: `Implement RLS policies for chats table`.
- Scope: SELECT admin OR participant; deny INSERT/UPDATE/DELETE for authenticated §11.2.
- Execute: ENABLE ROW LEVEL SECURITY
- Execute: Policies use is_platform_admin OR is_chat_participant
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Migration SQL

Dependencies:
- Task 19 helpers

Runtime Guarantees:
- Zero rows non-participant (R31-AC01)

Failure Handling:
- WITH CHECK false on mutations

Observability:
- RLS test in Task 101

Security Considerations:
- Initplan auth (R35-AC13)

Performance Considerations:
- Policy count minimal

Requirements covered:
31, 35, 15

Acceptance Criteria covered:
R15-AC06, R31-AC01, R35-AC01, R35-AC05, R35-AC06, R35-AC08, R35-AC09, R35-AC11

## 73. [ ] Implement RLS policies for chat_messages table

Description:
SELECT admin OR participant; deny direct mutations §11.2.

Responsibilities:
- chat_messages_select policy §11.2

Implementation Details:
- Normative reference: design.md — task 73: `Implement RLS policies for chat_messages table`.
- Scope: SELECT admin OR participant; deny direct mutations §11.2.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: chat_messages_select policy §11.2
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Migration SQL

Dependencies:
- Task 19

Runtime Guarantees:
- Realtime respects RLS (R13-AC02)

Failure Handling:
- Insert denied client-side

Observability:
- pgTAP RLS

Security Considerations:
- Participant scope

Performance Considerations:
- conversation_id index

Requirements covered:
3, 35

Acceptance Criteria covered:
R31-AC01, R35-AC01, R35-AC11, R35-AC12

## 74. [ ] Implement RLS policies for provider_proposals (CNS)

Description:
Client+provider of conversation+admin SELECT; RPC-only writes.

Responsibilities:
- Join conversation participant check

Implementation Details:
- Normative reference: design.md — task 74: `Implement RLS policies for provider_proposals (CNS)`.
- Scope: Client+provider of conversation+admin SELECT; RPC-only writes.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Join conversation participant check
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Migration SQL

Dependencies:
- Tasks 14, 19

Runtime Guarantees:
- Provider B cannot read A's proposal (R31-AC04)

Failure Handling:
- Direct insert denied

Observability:
- RLS tests

Security Considerations:
- Proposal isolation

Performance Considerations:
- conversation_id index

Requirements covered:
6, 35

Acceptance Criteria covered:
R35-AC02, R31-AC04, R35-AC10

## 75. [ ] Implement RLS policies for services table

Description:
Client, provider, admin SELECT; insert denied except via RPC.

Responsibilities:
- Contract readable by parties only

Implementation Details:
- Normative reference: design.md — task 75: `Implement RLS policies for services table`.
- Scope: Client, provider, admin SELECT; insert denied except via RPC.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Contract readable by parties only
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Migration SQL

Dependencies:
- Task 6

Runtime Guarantees:
- Post-accept read for both parties

Failure Handling:
- No client insert

Observability:
- RLS tests

Security Considerations:
- PII minimal

Performance Considerations:
- PK lookups

Requirements covered:
23, 35

Acceptance Criteria covered:
R23-AC02, R35-AC01

## 76. [ ] Implement RLS policies for domain_events and operational tables

Description:
domain_events, rpc_idempotency_records, job_runs: admin/service_role only; deny authenticated broad access.

Responsibilities:
- chat_rate_limit_buckets participant invisible
- Audit tables admin read

Implementation Details:
- Normative reference: design.md — task 76: `Implement RLS policies for domain_events and operational tables`.
- Scope: domain_events, rpc_idempotency_records, job_runs: admin/service_role only; deny authenticated broad access.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: chat_rate_limit_buckets participant invisible
- Execute: Audit tables admin read
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Migration SQL

Dependencies:
- Tasks 7, 8, 11, 12

Runtime Guarantees:
- Outbox not client-readable

Failure Handling:
- Default deny

Observability:
- Access audit

Security Considerations:
- Least privilege

Performance Considerations:
- N/A

Requirements covered:
28, 35

Acceptance Criteria covered:
R35-AC03, R35-AC11

## 77. [ ] Implement Storage RLS for chat-media bucket

Description:
Participant read; admin read; write via Edge service role only §3.13.

Responsibilities:
- Path prefix chat_id validation

Implementation Details:
- Normative reference: design.md — task 77: `Implement Storage RLS for chat-media bucket`.
- Scope: Participant read; admin read; write via Edge service role only §3.13.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Path prefix conversation_id validation
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Storage policies migration

Dependencies:
- Task 15

Runtime Guarantees:
- Signed URL 403 when expired (R31-AC06)

Failure Handling:
- Direct client upload denied

Observability:
- Storage access logs

Security Considerations:
- Admin read-only v1

Performance Considerations:
- N/A

Requirements covered:
31, 35

Acceptance Criteria covered:
R35-AC04, R31-AC06

## 78. [ ] Revoke direct INSERT/UPDATE on CNS mutable tables from authenticated

Description:
Defense in depth: GRANT SELECT only; mutations via RPC SECURITY DEFINER §11.2.

Responsibilities:
- Explicit REVOKE on chats, chat_messages, provider_proposals

Implementation Details:
- Normative reference: design.md — task 78: `Revoke direct INSERT/UPDATE on CNS mutable tables from authenticated`.
- Scope: Defense in depth: GRANT SELECT only; mutations via RPC SECURITY DEFINER §11.2.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Explicit REVOKE on conversations, chat_messages, provider_proposals
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Migration SQL

Dependencies:
- Tasks 72-75

Runtime Guarantees:
- PostgREST cannot bypass RPC FSM

Failure Handling:
- Permission denied errors

Observability:
- CI schema test

Security Considerations:
- Forces RPC path (OAC-01)

Performance Considerations:
- N/A

Requirements covered:
32, 35

Acceptance Criteria covered:
R35-AC03, R35-AC15, OAC-01

## 79. [ ] Implement pgTAP RLS suite for Requirement 35 matrix

Description:
Tests: admin reads all; provider C denied; participant read/write own; initplan policies §13.11.

Responsibilities:
- Fixtures for client/provider/admin roles
- Sixteen scenarios R35-AC16

Implementation Details:
- Normative reference: design.md — task 79: `Implement pgTAP RLS suite for Requirement 35 matrix`.
- Scope: Tests: admin reads all; provider C denied; participant read/write own; initplan policies §13.11.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Fixtures for client/provider/admin roles
- Execute: Sixteen scenarios R35-AC16
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- supabase/tests/chats/rls_cns_test.sql

Dependencies:
- Tasks 72-78

Runtime Guarantees:
- RLS matrix green before prod

Failure Handling:
- Fail CI on policy regression

Observability:
- CI report

Security Considerations:
- Uses test JWT roles

Performance Considerations:
- N/A

Requirements covered:
35, 31

Acceptance Criteria covered:
R35-AC01 through R35-AC16, R31-AC01, R31-AC02, R31-AC07

# Phase 12: Scalability & Performance

## 80. [ ] Verify and harden CNS index coverage migration

Description:
Audit all §3 indexes exist; add missing partial indexes for cron if query plan requires.

Responsibilities:
- EXPLAIN ANALYZE on list_conversations, list_chat_messages, cron scans

Implementation Details:
- Normative reference: design.md — task 80: `Verify and harden CNS index coverage migration`.
- Scope: Audit all §3 indexes exist; add missing partial indexes for cron if query plan requires.
- Execute: EXPLAIN ANALYZE on list_conversations, list_chat_messages, cron scans
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL migration if gaps

Dependencies:
- Tasks 1-4, 14

Runtime Guarantees:
- Cron scan uses reciprocity_poll_idx

Failure Handling:
- N/A

Observability:
- Slow query log

Security Considerations:
- N/A

Performance Considerations:
- Hot path indexes

Requirements covered:
22

Acceptance Criteria covered:
R22-AC03, R25-AC06

## 81. [ ] Enforce 1MB JSON payload cap in list RPCs

Description:
Truncate or reject list responses exceeding 1MB with projection §9.5.

Responsibilities:
- Column projection minimal
- Omit heavy payload fields from list

Implementation Details:
- Normative reference: design.md — task 81: `Enforce 1MB JSON payload cap in list RPCs`.
- Scope: Truncate or reject list responses exceeding 1MB with projection §9.5.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Column projection minimal
- Execute: Omit heavy payload fields from list
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Update list_conversations/list_chat_messages

Dependencies:
- Tasks 58, 59

Runtime Guarantees:
- Responses bounded (R22-AC04)

Failure Handling:
- 413 or field omission policy documented

Observability:
- Payload size metric

Security Considerations:
- N/A

Performance Considerations:
- Smaller network transfer

Requirements covered:
22

Acceptance Criteria covered:
R22-AC04

## 82. [ ] Add statement_timeout guard to accept and batch RPCs

Description:
SET LOCAL statement_timeout on accept_proposal and batch jobs to prevent runaway locks.

Responsibilities:
- Accept 5s local timeout with idempotency recovery path

Implementation Details:
- Normative reference: design.md — task 82: `Add statement_timeout guard to accept and batch RPCs`.
- Scope: SET LOCAL statement_timeout on accept_proposal and batch jobs to prevent runaway locks.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Accept 5s local timeout with idempotency recovery path
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- SQL ALTER functions

Dependencies:
- Tasks 29, 38, 44

Runtime Guarantees:
- Timeout returns retriable error

Failure Handling:
- Client uses idempotency replay

Observability:
- Timeout counter

Security Considerations:
- N/A

Performance Considerations:
- Protect connection pool

Requirements covered:
22, 27

Acceptance Criteria covered:
R27-AC03, R22-AC01

## 83. [ ] Document hot partition and SKIP LOCKED cron scaling notes

Description:
Engineering note §9.4: UUID spread, multiple cron workers safe, future audit partition.

Responsibilities:
- Runbook for ops

Implementation Details:
- Normative reference: design.md — task 83: `Document hot partition and SKIP LOCKED cron scaling notes`.
- Scope: Engineering note §9.4: UUID spread, multiple cron workers safe, future audit partition.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Runbook for ops
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- docs/chats/cns-scaling.md

Dependencies:
- Tasks 38, 44

Runtime Guarantees:
- Horizontal cron workers safe (R25-AC06)

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- SKIP LOCKED throughput

Requirements covered:
22, 25

Acceptance Criteria covered:
R22-AC03, R25-AC06

# Phase 13: Frontend Features (chats + negotiation-proposals)

## 84. [ ] Scaffold src/features/chats feature module Public API

Description:
Create api/, hooks/, components/, types/, utils/, index.ts per design §13.9.

Responsibilities:
- Export only via index.ts
- No cross-feature internal imports

Implementation Details:
- Normative reference: design.md — task 84: `Scaffold src/features/chats feature module Public API`.
- Scope: Create api/, hooks/, components/, types/, utils/, index.ts per design §13.9.
- Execute: Export only via index.ts
- Execute: No cross-feature internal imports
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Feature directory scaffold
- index.ts exports

Dependencies:
- Wave A types generated

Runtime Guarantees:
- Feature boundary enforced

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- No Supabase in components rule

Performance Considerations:
- N/A

Requirements covered:
17, 18

Acceptance Criteria covered:
R17-AC09, OAC-01

## 85. [ ] Scaffold src/features/negotiation-proposals feature module

Description:
Separate proposal composer and accept/reject flows per design §13.9.

Responsibilities:
- api/ for proposal RPCs
- Extract from provider-jobs

Implementation Details:
- Normative reference: design.md — task 85: `Scaffold src/features/negotiation-proposals feature module`.
- Scope: Separate proposal composer and accept/reject flows per design §13.9.
- Execute: api/ for proposal RPCs
- Execute: Extract from provider-jobs
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Feature scaffold

Dependencies:
- Task 84

Runtime Guarantees:
- Isolated proposal concerns

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- API layer only rpc

Performance Considerations:
- N/A

Requirements covered:
6, 7, 10

Acceptance Criteria covered:
R6-AC01, R6-AC03, R7-AC01

## 86. [ ] Implement chats API layer (chats.api.ts)

Description:
Wrap cns_send_message, list_conversations, list_chat_messages, mark_read, get_detail — no .from().insert() §5.3.

Responsibilities:
- Typed ApiResult pattern
- Map business errors to UI

Implementation Details:
- Normative reference: design.md — task 86: `Implement chats API layer (chats.api.ts)`.
- Scope: Wrap cns_send_message, list_conversations, list_chat_messages, mark_read, get_detail — no .from().insert() §5.3.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Typed ApiResult pattern
- Execute: Map business errors to UI
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- src/features/chats/api/chats.api.ts

Dependencies:
- Tasks 26, 58-60, 35

Runtime Guarantees:
- All writes via rpc

Failure Handling:
- Network retry idempotency keys

Observability:
- API error metrics

Security Considerations:
- JWT authenticated only

Performance Considerations:
- N/A

Requirements covered:
3, 17

Acceptance Criteria covered:
R3-AC07, R17-AC01, OAC-01

## 87. [ ] Implement negotiation-proposals API layer

Description:
Wrap submit_proposal, accept, reject, revision, decline, list_versions.

Responsibilities:
- UUID idempotency_key per mutation

Implementation Details:
- Normative reference: design.md — task 87: `Implement negotiation-proposals API layer`.
- Scope: Wrap submit_proposal, accept, reject, revision, decline, list_versions.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: UUID idempotency_key per mutation
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- src/features/negotiation-proposals/api/proposals.api.ts

Dependencies:
- Tasks 28-32, 62

Runtime Guarantees:
- Server confirms before UI success (R6-AC07)

Failure Handling:
- 409/422 mapping

Observability:
- Proposal mutation metrics

Security Considerations:
- Role-aware calls

Performance Considerations:
- N/A

Requirements covered:
6, 7, 8, 10

Acceptance Criteria covered:
R6-AC07, R7-AC01, R8-AC01, R10-AC01

## 88. [ ] Implement useChatMessages hook with optimistic send

Description:
useInfiniteQuery keyset; optimistic bubble; replace on RPC success; idempotency key per send §4.9.

Responsibilities:
- Merge cursor on reconnect (R13-AC04)
- Deduplicate by id

Implementation Details:
- Normative reference: design.md — task 88: `Implement useChatMessages hook with optimistic send`.
- Scope: useInfiniteQuery keyset; optimistic bubble; replace on RPC success; idempotency key per send §4.9.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Merge cursor on reconnect (R13-AC04)
- Execute: Deduplicate by id
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- src/features/chats/hooks/useChatMessages.ts

Dependencies:
- Tasks 86, 59, 26

Runtime Guarantees:
- Optimistic replaced on confirm (R13-AC05)

Failure Handling:
- Failed mark retry same key (R3-AC07)

Observability:
- Client send latency

Security Considerations:
- No send without auth

Performance Considerations:
- Virtualize >500 msgs SHOULD (R13-AC07)

Requirements covered:
3, 13, 14

Acceptance Criteria covered:
R3-AC07, R3-AC08, R13-AC04, R13-AC05, R13-AC07

## 89. [ ] Implement useConversationRealtime hook

Description:
Channel conversation:{id}; INSERT messages UPDATE proposals; invalidate TanStack queries §5.4.

Responsibilities:
- Private channel
- Filter postgres_changes

Implementation Details:
- Normative reference: design.md — task 89: `Implement useConversationRealtime hook`.
- Scope: Channel conversation:{id}; INSERT messages UPDATE proposals; invalidate TanStack queries §5.4.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Private channel
- Execute: Filter postgres_changes
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- hook file

Dependencies:
- Tasks 17, 86

Runtime Guarantees:
- At-least-once dedupe (R13-AC04)

Failure Handling:
- Reconnect triggers reconcile

Observability:
- Subscription status metric

Security Considerations:
- RLS-scoped events only

Performance Considerations:
- Single channel per open chat

Requirements covered:
13, 22

Acceptance Criteria covered:
R13-AC01, R13-AC02, R22-AC02

## 90. [ ] Implement usePushNotificationSuppression hook

Description:
Suppress FCM toast when foreground+activeConversationId match; web hidden tab = background R12-AC11-12 §4.11.

Responsibilities:
- Integrate Capacitor and SW handlers
- Compare payload.chat_id

Implementation Details:
- Normative reference: design.md — task 90: `Implement usePushNotificationSuppression hook`.
- Scope: Suppress FCM toast when foreground+activeConversationId match; web hidden tab = background R12-AC11-12 §4.11.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Integrate Capacitor and SW handlers
- Execute: Compare payload.conversation_id
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- usePushNotificationSuppression.ts

Dependencies:
- Task 84

Runtime Guarantees:
- No duplicate toast on open chat (R12-AC07)

Failure Handling:
- Fallback show on other screens (R12-AC08)

Observability:
- Suppression rate debug log

Security Considerations:
- No extra PII in handler

Performance Considerations:
- Early return before toast API

Requirements covered:
12, 13

Acceptance Criteria covered:
R12-AC07, R12-AC08, R12-AC09, R12-AC10, R12-AC11, R12-AC12, R13-AC01

## 91. [ ] Implement useConversationPollingFallback hook

Description:
15s poll open chat only when Realtime disconnected §9.3 R30-AC01.

Responsibilities:
- Disable when Realtime healthy
- No global list poll

Implementation Details:
- Normative reference: design.md — task 91: `Implement useConversationPollingFallback hook`.
- Scope: 15s poll open chat only when Realtime disconnected §9.3 R30-AC01.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Disable when Realtime healthy
- Execute: No global list poll
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- hook file

Dependencies:
- Task 87

Runtime Guarantees:
- Polling ≥5s stable (OAC-15)

Failure Handling:
- Stop poll on reconnect

Observability:
- Poll fallback metric

Security Considerations:
- Same auth as queries

Performance Considerations:
- 15s interval max

Requirements covered:
30, 22

Acceptance Criteria covered:
R30-AC01, OAC-15

## 92. [ ] Implement useChatComposerState hook (proposal-gated input)

Description:
Derive disabled state from get_proposal_for_timeline / free messaging query; copy for PENDING §4.2.

Responsibilities:
- Enable on REVISION_REQUESTED (R18-AC07)
- Disable on PENDING (R18-AC06)

Implementation Details:
- Normative reference: design.md — task 92: `Implement useChatComposerState hook (proposal-gated input)`.
- Scope: Derive disabled state from get_proposal_for_timeline / free messaging query; copy for PENDING §4.2.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Enable on REVISION_REQUESTED (R18-AC07)
- Execute: Disable on PENDING (R18-AC06)
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- hook file

Dependencies:
- Tasks 61, 25 helper exposure via query

Runtime Guarantees:
- UI matches server gate (R34-AC02)

Failure Handling:
- Refetch on proposal Realtime update

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
18, 34

Acceptance Criteria covered:
R18-AC06, R18-AC07, R34-AC02, R34-AC15

## 93. [ ] Implement useChatActionBannerState hook

Description:
Priority stack CTAs per design spec §19; session-only dismiss R19-AC06.

Responsibilities:
- Revision > send proposal > view proposal
- Wire to modals

Implementation Details:
- Normative reference: design.md — task 93: `Implement useChatActionBannerState hook`.
- Scope: Priority stack CTAs per design spec §19; session-only dismiss R19-AC06.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Revision > send proposal > view proposal
- Execute: Wire to modals
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- hook + ChatActionBanner component

Dependencies:
- Tasks 61, 88

Runtime Guarantees:
- Highest priority only (R19-AC02)

Failure Handling:
- Dismiss session localStorage optional

Observability:
- Banner impression analytics

Security Considerations:
- Accessible labels (R19-AC08)

Performance Considerations:
- N/A

Requirements covered:
19, 34

Acceptance Criteria covered:
R19-AC01 through R19-AC08, R34-AC15

## 94. [ ] Implement ChatListPage and ChatListItem components

Description:
Paginated list, preview types, unread, empty state, ellipsis §17 design spec.

Responsibilities:
- Desktop split 320-420px sidebar (R17-AC08)

Implementation Details:
- Normative reference: design.md — task 94: `Implement ChatListPage and ChatListItem components`.
- Scope: Paginated list, preview types, unread, empty state, ellipsis §17 design spec.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Desktop split 320-420px sidebar (R17-AC08)
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Components per chat-list-item-design-spec

Dependencies:
- Tasks 58, 84

Runtime Guarantees:
- Navigate on tap (R17-AC06)

Failure Handling:
- Skeleton loading (R20-AC05)

Observability:
- List render perf

Security Considerations:
- N/A

Performance Considerations:
- Virtualize long lists optional

Requirements covered:
17, 20

Acceptance Criteria covered:
R17-AC01 through R17-AC09, R20-AC05

## 95. [ ] Implement ChatScreen with header, timeline, keyboard safety

Description:
Fixed header/input, scrollable timeline, Capacitor Keyboard, safe areas §18 design spec.

Responsibilities:
- Message grouping R18-AC04
- Scroll to latest on open R18-AC03

Implementation Details:
- Normative reference: design.md — task 95: `Implement ChatScreen with header, timeline, keyboard safety`.
- Scope: Fixed header/input, scrollable timeline, Capacitor Keyboard, safe areas §18 design spec.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Message grouping R18-AC04
- Execute: Scroll to latest on open R18-AC03
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- ChatScreen components

Dependencies:
- Tasks 86-89, 90

Runtime Guarantees:
- Mobile-first ux compliance

Failure Handling:
- Error state actionable (R20-AC06)

Observability:
- Playwright mobile-safari

Security Considerations:
- N/A

Performance Considerations:
- Virtualize timeline >500

Requirements covered:
18, 20

Acceptance Criteria covered:
R18-AC01 through R18-AC10, R20-AC06, R20-AC07

## 96. [ ] Implement DynamicMessageRenderer and DynamicProposalCard

Description:
Hydrate proposal cards; role CTAs; unknown type fallback §16 design spec.

Responsibilities:
- get_proposal_for_timeline on expand
- Preserve scroll on expand R16-AC06

Implementation Details:
- Normative reference: design.md — task 96: `Implement DynamicMessageRenderer and DynamicProposalCard`.
- Scope: Hydrate proposal cards; role CTAs; unknown type fallback §16 design spec.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: get_proposal_for_timeline on expand
- Execute: Preserve scroll on expand R16-AC06
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Components

Dependencies:
- Tasks 61, 87

Runtime Guarantees:
- Fallback no crash (R16-AC04)

Failure Handling:
- Hydration error UI (R30-AC03)

Observability:
- Card render metrics

Security Considerations:
- Role-based CTA hide

Performance Considerations:
- Lazy hydrate

Requirements covered:
16, 30

Acceptance Criteria covered:
R16-AC01 through R16-AC08, R30-AC03

## 97. [ ] Migrate ProposalComposer from ProviderProposalComposerDialog

Description:
negotiation-proposals/components/ProposalComposer.tsx with Zod validation mirroring RPC §13.8.

Responsibilities:
- Debounce local draft only not SOT
- Pricing signature integration

Implementation Details:
- Normative reference: design.md — task 97: `Migrate ProposalComposer from ProviderProposalComposerDialog`.
- Scope: negotiation-proposals/components/ProposalComposer.tsx with Zod validation mirroring RPC §13.8.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Debounce local draft only not SOT
- Execute: Pricing signature integration
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Component migration

Dependencies:
- Tasks 85, 28

Runtime Guarantees:
- Submit idempotent (R6-AC07)

Failure Handling:
- Validation errors inline

Observability:
- Compose funnel analytics

Security Considerations:
- Provider role UI only

Performance Considerations:
- N/A

Requirements covered:
6

Acceptance Criteria covered:
R6-AC01, R6-AC03, R6-AC04, R6-AC06

## 98. [ ] Implement AcceptProposalDialog, RejectDialog, RevisionRequestDialog

Description:
Accept: mandatory selected_slot picker R7-AC02; block offline accept R30-AC05.

Responsibilities:
- AcceptProposalDialog in negotiation-proposals
- Revision counter UI R10-AC07

Implementation Details:
- Normative reference: design.md — task 98: `Implement AcceptProposalDialog, RejectDialog, RevisionRequestDialog`.
- Scope: Accept: mandatory selected_slot picker R7-AC02; block offline accept R30-AC05.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: AcceptProposalDialog in negotiation-proposals
- Execute: Revision counter UI R10-AC07
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Modal components

Dependencies:
- Tasks 91, 29-31

Runtime Guarantees:
- No optimistic accept

Failure Handling:
- 409 handling user messaging

Observability:
- Conversion analytics

Security Considerations:
- Client-only actions

Performance Considerations:
- N/A

Requirements covered:
7, 8, 10, 30

Acceptance Criteria covered:
R7-AC01, R7-AC02, R8-AC01, R10-AC01, R10-AC06, R10-AC07, R30-AC05

## 99. [ ] Implement useProposalCountdown hook

Description:
Countdown from submitted_at + platform_constants SLA; sync with server time skew guard §4.12.

Responsibilities:
- Display <=4h warning state R9-AC07

Implementation Details:
- Normative reference: design.md — task 99: `Implement useProposalCountdown hook`.
- Scope: Countdown from submitted_at + platform_constants SLA; sync with server time skew guard §4.12.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Display <=4h warning state R9-AC07
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- hook

Dependencies:
- Task 10 constants readable

Runtime Guarantees:
- UI-only derived state

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
9

Acceptance Criteria covered:
R9-AC07, R9-AC08

# Phase 14: Verification & Rollout

## 100. [ ] Implement ChatsLayout desktop split view and lazy router routes

Description:
React Router lazy routes; ChatsLayout sidebar+panel §17.

Responsibilities:
- lazy() imports in router.tsx

Implementation Details:
- Normative reference: design.md — task 100: `Implement ChatsLayout desktop split view and lazy router routes`.
- Scope: React Router lazy routes; ChatsLayout sidebar+panel §17.
- Execute: lazy() imports in router.tsx
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Layout + route registration

Dependencies:
- Tasks 92-93, 84

Runtime Guarantees:
- Routes registered when Phase 13–14 tasks merge; auth guard protects access

Failure Handling:
- N/A

Observability:
- Route load metrics

Security Considerations:
- Auth guard existing

Performance Considerations:
- Code split bundles

Requirements covered:
17, 18

Acceptance Criteria covered:
R17-AC08, R1-AC05

## 101. [ ] Implement pgTAP CNS FSM transition test suite

Description:
Cover send, submit, accept, reject, revision, close, cancel, expire, reciprocity paths.

Responsibilities:
- All terminal states asserted
- No partial accept

Implementation Details:
- Normative reference: design.md — task 101: `Implement pgTAP CNS FSM transition test suite`.
- Scope: Cover send, submit, accept, reject, revision, close, cancel, expire, reciprocity paths.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: All terminal states asserted
- Execute: No partial accept
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- supabase/tests/chats/fsm_transitions_test.sql

Dependencies:
- Tasks 26-39

Runtime Guarantees:
- Green required for merge

Failure Handling:
- Fail blocks release

Observability:
- CI pgTAP

Security Considerations:
- Test roles

Performance Considerations:
- Transactional rollback per test

Requirements covered:
1-11, 32

Acceptance Criteria covered:
R7-AC07, R32-AC01, R32-AC02, R32-AC03, OAC-11

## 102. [ ] Implement pgTAP proposal-gated messaging tests

Description:
Five scenarios R34-AC14: Discovery OK; PENDING fail; REVISION OK; re-PENDING fail; REJECTED OK.

Responsibilities:
- Direct cns_send_message assertions

Implementation Details:
- Normative reference: design.md — task 102: `Implement pgTAP proposal-gated messaging tests`.
- Scope: Five scenarios R34-AC14: Discovery OK; PENDING fail; REVISION OK; re-PENDING fail; REJECTED OK.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Direct cns_send_message assertions
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- supabase/tests/chats/free_messaging_test.sql

Dependencies:
- Tasks 25, 26, 28, 30

Runtime Guarantees:
- Server gate authoritative

Failure Handling:
- CI gate

Observability:
- Test output

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
34

Acceptance Criteria covered:
R34-AC01, R34-AC02, R34-AC05, R34-AC08, R34-AC11, R34-AC14, OAC-13

## 103. [ ] Implement pgTAP concurrent slot and accept race tests

Description:
Two-session tests: last slot race R4-AC09; dual accept R7-AC03; cancel vs accept R2-AC06.

Responsibilities:
- pgTAP concurrent sessions

Implementation Details:
- Normative reference: design.md — task 103: `Implement pgTAP concurrent slot and accept race tests`.
- Scope: Two-session tests: last slot race R4-AC09; dual accept R7-AC03; cancel vs accept R2-AC06.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: pgTAP concurrent sessions
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- supabase/tests/chats/concurrency_test.sql

Dependencies:
- Tasks 26, 29, 34, 41

Runtime Guarantees:
- Exactly one winner

Failure Handling:
- CI required

Observability:
- Race metrics in logs

Security Considerations:
- N/A

Performance Considerations:
- FOR UPDATE validation

Requirements covered:
4, 14

Acceptance Criteria covered:
R4-AC09, R7-AC03, R2-AC06, R14-AC02, OAC-03

## 104. [ ] Implement Vitest tests for chat hooks

Description:
MSW mock RPC: cursor merge, suppression logic, offline accept block, 429 retry UI.

Responsibilities:
- happy-dom environment where needed

Implementation Details:
- Normative reference: design.md — task 104: `Implement Vitest tests for chat hooks`.
- Scope: MSW mock RPC: cursor merge, suppression logic, offline accept block, 429 retry UI.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: happy-dom environment where needed
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- src/features/chats/**/*.test.ts

Dependencies:
- Tasks 86-89

Runtime Guarantees:
- Regression guard frontend logic

Failure Handling:
- CI vitest

Observability:
- Coverage report

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
13, 30

Acceptance Criteria covered:
R13-AC04, R13-AC05, R30-AC05, R30-AC06, R12-AC07

## 105. [ ] Implement Deno tests for chat-upload-media Edge Function

Description:
Validate magic bytes, size limits, session validation mock.

Responsibilities:
- yarn test:deno filter chat-upload

Implementation Details:
- Normative reference: design.md — task 105: `Implement Deno tests for chat-upload-media Edge Function`.
- Scope: Validate magic bytes, size limits, session validation mock.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: yarn test:deno filter chat-upload
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Edge function tests

Dependencies:
- Task 54

Runtime Guarantees:
- Upload rejects invalid files

Failure Handling:
- CI deno project

Observability:
- Test logs

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
3, 26

Acceptance Criteria covered:
R3-AC06, R26-AC06

## 106. [ ] Implement Playwright E2E CNS happy paths

Description:
Mobile-safari: send message, submit proposal, accept with slot picker, keyboard visibility.

Responsibilities:
- e2e/chats.spec.ts
- Uses staging Supabase

Implementation Details:
- Normative reference: design.md — task 106: `Implement Playwright E2E CNS happy paths`.
- Scope: Mobile-safari: send message, submit proposal, accept with slot picker, keyboard visibility.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: e2e/chats.spec.ts
- Execute: Uses staging Supabase
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Artifacts listed in Responsibilities and migration/RPC deliverables

Dependencies:
- Tasks 92-96, 98

Runtime Guarantees:
- Critical path green before Wave F

Failure Handling:
- Flake retries limited

Observability:
- E2E artifact videos

Security Considerations:
- Test user fixtures

Performance Considerations:
- Parallel sharding

Requirements covered:
1, 7, 18

Acceptance Criteria covered:
R18-AC08, R18-AC10, R7-AC01, R1-AC05

## 107. [ ] Execute Wave A rollout validation checklist

Description:
Verify enums/tables/RLS helpers deployed; types generated; no client enablement.

Responsibilities:
- Schema diff review
- Staged db:migrate
- Rollback script documented

Implementation Details:
- Normative reference: design.md — task 107: `Execute Wave A rollout validation checklist`.
- Scope: Verify enums/tables/RLS helpers deployed; types generated; no client enablement.
- Execute: Schema diff review
- Execute: Staged db:migrate
- Execute: Rollback script documented
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Wave A signoff checklist

Dependencies:
- Tasks 1-22

Runtime Guarantees:
- Schema matches design §3

Failure Handling:
- Rollback drops new tables if no prod data

Observability:
- Migration logs

Security Considerations:
- No public writes

Performance Considerations:
- N/A

Requirements covered:
15, 35

Acceptance Criteria covered:
R15-AC01, R35-AC11, OAC-01

## 108. [ ] Execute Wave B-F staged rollout

Description:
Progressive enablement per §13.10; monitor job_runs and domain_events backlog between waves.

Responsibilities:
- Wave-by-wave deploy order (B→F) per §13.10
- Canary cohort monitoring 72h

Implementation Details:
- Normative reference: design.md — task 108: `Execute Wave B-F staged rollout`.
- Scope: Progressive enablement per §13.10; monitor job_runs and domain_events backlog between waves.
- Execute: Wave-by-wave deploy order (B→F) per §13.10
- Execute: Canary cohort monitoring 72h
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- Rollout runbook
- Wave checklist and monitoring dashboards

Dependencies:
- Tasks 26-99

Runtime Guarantees:
- Each wave independently reversible except Wave E prod data

Failure Handling:
- Rollback playbook per wave

Observability:
- Dashboards during rollout

Security Considerations:
- Gradual exposure

Performance Considerations:
- Monitor p95 latencies

Requirements covered:
24, 30

Acceptance Criteria covered:
R24-AC01, R30-AC01, R30-AC02

## 109. [ ] Integrate CNS tests into yarn ci pipeline

Description:
Vitest + pgTAP + Deno + E2E optional gate; consolidated summary per AGENTS.md.

Responsibilities:
- Update ci script if needed

Implementation Details:
- Normative reference: design.md — task 109: `Integrate CNS tests into yarn ci pipeline`.
- Scope: Vitest + pgTAP + Deno + E2E optional gate; consolidated summary per AGENTS.md.
- Execute: Implement per design.md; see Description for normative section reference
- Execute: Update ci script if needed
- Gate: automated tests in Phase 14 (pgTAP/Vitest/E2E) green before merge.

Deliverables:
- CI config

Dependencies:
- Tasks 100-106

Runtime Guarantees:
- CI green required for main

Failure Handling:
- Fail fast on pgTAP

Observability:
- CI metrics

Security Considerations:
- N/A

Performance Considerations:
- Parallel test jobs

Requirements covered:
21, 25

Acceptance Criteria covered:
R25-AC08, R33-AC07, R35-AC16

## 110. [ ] Sync business documentation after CNS cutover

Description:
Update docs/business per business-docs-sync rule when product behavior changes.

Responsibilities:
- platform-flow alignment
- Slot semantics §3.3.1 documented for support

Implementation Details:
- Normative reference: design.md §4–§13; RPC catalog §5.1 where applicable — `Create CNS PostgreSQL enum types`.
- Scope (task 1): Implement migration creating all normative CNS enum types per design §3.1.
- Execute: Define FSM enum values matching platform-flow.mmd
- Execute: Document legacy provider_proposals.status mapping
- Execute: Migration YYYYMMDDHHMMSS_create_cns_enums.sql
- Execute: Types: cns_conversation_status, cns_closure_type, cns_inactivation_reason, cns_message_type, cns_delivery_status, proposal_status, proposal_revision_reason, service_request_status, contracted_service_status
- Execute: Migration SQL
- Execute: Mapping comment block
- Execute: None — first CNS migration
- Gate: pgTAP / Vitest / Playwright per Phase 14 before production enablement.

Deliverables:
- docs/business/ updates

Dependencies:
- Wave F complete

Runtime Guarantees:
- Support docs match runtime

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- Accurate operator docs

Performance Considerations:
- N/A

Requirements covered:
4, 33, 34

Acceptance Criteria covered:
R33-AC09, R4-AC05, R34-AC15

## 111. [ ] Implement useConversationTypingPresence hook

Description:
Realtime presence channel for typing indicator per design §5.4: `conversation:{id}:presence`, TTL ≤10s, throttle ≤1 event/2s per client (Req. 5, R5-AC04).

Responsibilities:
- Subscribe only on open ChatScreen; unsubscribe on leave
- Broadcast `{ user_id, typing: boolean }` on input debounce
- Client-side expiry at 10s without heartbeat (R27-AC04)

Implementation Details:
- Hook `useConversationTypingPresence(conversationId)` in `src/features/chats/hooks/`
- `supabase.channel('conversation:' + id + ':presence')` with `presence` API
- MUST NOT persist typing state server-side
- MUST NOT exceed 1 publish / 2s / user (debounce 500ms, coalesce)
- Other participant bubble: show "typing…" until TTL expires

Deliverables:
- `useConversationTypingPresence.ts`
- Vitest: throttle + TTL unit tests
- Optional E2E smoke in task 106

Dependencies:
- Task 89 (useConversationRealtime)
- Task 18 (Realtime publication)

Runtime Guarantees:
- Ephemeral only; no effect on reciprocity or slots

Failure Handling:
- Realtime down → typing disabled silently (no error toast)

Observability:
- Debug metric `cns_typing_events_throttled_total` (client)

Security Considerations:
- Channel scoped to conversation; RLS on parent conversation required

Performance Considerations:
- Unsubscribe on unmount; no global presence fanout

Requirements covered:
5, 27

Acceptance Criteria covered:
R5-AC04, R27-AC04

---

## 112. [ ] Implement optional discovery system welcome message

Description:
Product-configurable MAY insert `message_type = SYSTEM` on first chat activation orienting discovery (Req. 5, R5-AC03).

Responsibilities:
- Gate via `platform_constants` key e.g. `chats.discovery_welcome_enabled` (default false)
- Insert inside `cns_send_message` internal path on new conversation only
- MUST NOT enable free messaging (R34-AC12)

Implementation Details:
- SQL or RPC branch after `INSERT conversation ACTIVE` for new pair
- Payload template in migration seed (PT-BR product copy)
- Idempotent: skip if system welcome already exists for conversation
- Admin MAY disable without redeploy (read constant per TX)

Deliverables:
- Migration seed + branch in `cns_send_message`
- pgTAP: welcome inserted once; not inserted when disabled

Dependencies:
- Task 28
- Task 10

Runtime Guarantees:
- Same transaction as first message

Failure Handling:
- Welcome insert failure MUST NOT block first user message (savepoint optional)

Observability:
- Counter `cns_discovery_welcome_inserted_total`

Security Considerations:
- `sender_user_id` null; system message not editable by participants

Performance Considerations:
- Single extra insert on new chat only

Requirements covered:
5, 34

Acceptance Criteria covered:
R5-AC03, R34-AC12

---

## 113. [ ] Implement CNS visual states and accessibility pass

Description:
Cross-cutting UI tokens and states for ACTIVE/INACTIVE/CLOSED chats and proposal CTAs per Req. 20 and checklist §11–13.

Responsibilities:
- List + header visual weight for INACTIVE vs ACTIVE (R20-AC01, R4-AC05)
- Proposal card CTA states: PENDING primary, ACCEPTED success, EXPIRED disabled (R20-AC02)
- WCAG: status MUST NOT rely on color alone — icons + text (R20-AC03)
- Toast on accept/close (R20-AC04)

Implementation Details:
- Tailwind tokens in `src/features/chats/` (or extend design system)
- `ChatListItem`, `ChatScreenHeader`, `DynamicProposalCard` consume `conversation.status` + `proposal.status`
- Verify 44px touch targets (R20-AC07) on banner and card CTAs
- Focus ring on desktop interactive elements

Deliverables:
- Token map doc in feature README or Storybook notes
- Visual regression snapshots optional

Dependencies:
- Tasks 94, 95, 96, 113

Runtime Guarantees:
- States driven from server SOT queries only

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- CSS-only state changes; no extra API calls

Requirements covered:
4, 20

Acceptance Criteria covered:
R4-AC05, R11-AC05, R20-AC01, R20-AC02, R20-AC03, R20-AC04, R20-AC07

---

## 114. [ ] AC traceability closure gate (pre–Wave F)

Description:
Governance task: verify every `R{n}-AC{ii}` in design §12.2 and OAC-01–18 maps to ≥1 implementation task and ≥1 verification artifact before Wave F production cutover.

Responsibilities:
- Run automated AC coverage script against `tasks.md` + this supplement
- Sign-off checklist attached to release PR
- File gaps as blocking defects

Implementation Details:
- Script: parse all `R*-AC*` from `requirements.md` / design §12.2; grep `tasks.md` for each ID
- Require mapping: AC → task # → test (pgTAP path | Vitest path | E2E spec | manual QA only for pure copy)
- OAC-05 → tasks 8, 24, 51, 54, 71; OAC-10 → 17, 72–79
- R32-AC05: document review — no Edge FSM, no second SOT
- R32-AC06: pgTAP concurrent accept uses `FOR UPDATE` on SR
- Block Wave F if any AC unmapped

Deliverables:
- `scripts/audit-cns-ac-coverage.ts` (or CI step)
- `docs/chats/ac-coverage-signoff.md` template
- CI job `cns-ac-coverage` in pipeline

Dependencies:
- Tasks 101–106, 79, 102–103, 111–113

Runtime Guarantees:
- 273/273 AC IDs referenced in task metadata

Failure Handling:
- CI fails on missing AC

Observability:
- Coverage report artifact in CI

Security Considerations:
- N/A

Performance Considerations:
- Grep-only; <10s

Requirements covered:
1–35, 32

Acceptance Criteria covered:
R32-AC05, R32-AC06, OAC-01, OAC-02, OAC-03, OAC-04, OAC-05, OAC-06, OAC-07, OAC-08, OAC-09, OAC-10, OAC-11, OAC-12, OAC-13, OAC-14, OAC-15, OAC-16, OAC-17, OAC-18

---

# Appendix A: Acceptance Criteria Traceability Matrix

> **Normative source:** [`requirements.md`](./requirements.md) · [`design.md`](./design.md) §12.2  
> **Primary task:** owning implementation · **Verification:** how AC is proven

| AC ID | Req | Primary Task | Verification |
|-------|-----|--------------|--------------|
| R1-AC01 | 1 | 28 | pgTAP `send_message` |
| R1-AC02 | 1 | 28 | pgTAP slot parallel |
| R1-AC03 | 1 | 28 | pgTAP messaging |
| R1-AC04 | 1 | 101 | pgTAP FSM discovery phase |
| R1-AC05 | 1 | 106 | E2E reload SOT |
| R1-AC06 | 1 | 101 | pgTAP audit vs platform-flow |
| R2-AC01 | 2 | 13 | migration CHECK |
| R2-AC02 | 2 | 28 | pgTAP SR COMPLETED reject |
| R2-AC03 | 2 | 31 | pgTAP accept |
| R2-AC04 | 2 | 31 | pgTAP services insert |
| R2-AC05 | 2 | 36 | pgTAP cancel |
| R2-AC06 | 2 | 36 | pgTAP cancel vs accept race |
| R2-AC07 | 2 | 45 | domain event optional |
| R2-AC08 | 2 | 13 | migration timestamps |
| R2-AC09 | 2 | 101 | traceability review |
| R3-AC01 | 3 | 28 | pgTAP |
| R3-AC02 | 3 | 28 | pgTAP + 102 |
| R3-AC03 | 3 | 28 | pgTAP reactivation |
| R3-AC04 | 3 | 28 | pgTAP CLOSED |
| R3-AC05 | 3 | 96 | Vitest renderer |
| R3-AC06 | 3 | 54 | Deno upload |
| R3-AC07 | 3 | 28 | Vitest optimistic |
| R3-AC08 | 3 | 59 | pgTAP pagination |
| R3-AC09 | 3 | 28 | pgTAP last_interaction |
| R3-AC10 | 3 | 37 | pgTAP read receipt |
| R3-AC11 | 3 | 26 | pgTAP 429 |
| R3-AC12 | 3 | 106 | E2E checklist |
| R4-AC01 | 4 | 28 | pgTAP slot |
| R4-AC02 | 4 | 38 | pgTAP reciprocity |
| R4-AC03 | 4 | 38 | pgTAP bilateral |
| R4-AC04 | 4 | 38 | pgTAP INACTIVE |
| R4-AC05 | 4 | 113 | visual QA |
| R4-AC06 | 4 | 28 | pgTAP slot reject |
| R4-AC07 | 4 | 28 | pgTAP idempotent pair |
| R4-AC08 | 4 | 28 | pgTAP SR completed |
| R4-AC09 | 4 | 103 | pgTAP concurrent slot |
| R5-AC01 | 5 | 28 | E2E multiline/image |
| R5-AC02 | 5 | 60 | RPC get_conversation_detail |
| R5-AC03 | 5 | 112 | pgTAP welcome |
| R5-AC04 | 5 | 111 | Vitest + E2E typing |
| R5-AC05 | 5 | 96 | revision history UI |
| R5-AC06 | 5 | 106 | E2E checklist §5 |
| R6-AC01 | 6 | 30 | pgTAP submit |
| R6-AC02 | 6 | 30 | pgTAP PENDING |
| R6-AC03 | 6 | 92 | Vitest composer disabled |
| R6-AC04 | 6 | 30 | pgTAP no edit |
| R6-AC05 | 6 | 30 | pgTAP REVISED |
| R6-AC06 | 6 | 96 | UI slots display |
| R6-AC07 | 6 | 30 | Vitest retry |
| R6-AC08 | 6 | 30 | pgTAP timeline msg |
| R6-AC09 | 6 | 101 | FSM pgTAP |
| R7-AC01 | 7 | 98 | E2E accept modal |
| R7-AC02 | 7 | 31 | pgTAP cascade |
| R7-AC03 | 7 | 103 | pgTAP race |
| R7-AC04 | 7 | 95 | E2E closed input |
| R7-AC05 | 7 | 45 | MMD idempotency |
| R7-AC06 | 7 | 31 | pgTAP expired reject |
| R7-AC07 | 7 | 101 | pgTAP atomicity |
| R8-AC01 | 8 | 32 | pgTAP reject |
| R8-AC02 | 8 | 32 | pgTAP + 102 |
| R8-AC03 | 8 | 35 | E2E manual close |
| R8-AC04 | 8 | 96 | Vitest card state |
| R8-AC05 | 8 | 101 | platform-flow |
| R9-AC01 | 9 | 39 | pgTAP expire |
| R9-AC02 | 9 | 31 | pgTAP accept expired |
| R9-AC03 | 9 | 39 | pgTAP free chat |
| R9-AC04 | 9 | 39 | pgTAP discovery continue |
| R9-AC05 | 9 | 39 | pgTAP optional INACTIVE |
| R9-AC06 | 9 | 30 | pgTAP resubmit |
| R9-AC07 | 9 | 46 | consumer reminder |
| R9-AC08 | 9 | 99 | Vitest countdown UI |
| R10-AC01 | 10 | 33 | pgTAP revision |
| R10-AC02 | 10 | 28 | pgTAP free msg |
| R10-AC03 | 10 | 30 | pgTAP new PENDING |
| R10-AC04 | 10 | 34 | pgTAP decline |
| R10-AC05 | 10 | 33 | pgTAP date revision |
| R10-AC06 | 10 | 33 | pgTAP limit 2 |
| R10-AC07 | 10 | 98 | UI counter |
| R10-AC08 | 10 | 30 | pgTAP resubmit |
| R10-AC09 | 10 | 34 | pgTAP decline path |
| R10-AC10 | 10 | 30 | pgTAP SLA reset |
| R10-AC11 | 10 | 62 | list_proposal_versions |
| R10-AC12 | 10 | 101 | platform-flow AA–AG |
| R11-AC01 | 11 | 35 | E2E confirm |
| R11-AC02 | 11 | 35 | pgTAP close |
| R11-AC03 | 11 | 35 | pgTAP slot decrement |
| R11-AC04 | 11 | 35 | pgTAP new provider |
| R11-AC05 | 11 | 94 | visual CLOSED |
| R12-AC01 | 12 | 45 | integration MMD |
| R12-AC02 | 12 | 42 | MMD bypass test |
| R12-AC03 | 12 | 45 | consumer |
| R12-AC04 | 12 | 42 | MMD dedupe |
| R12-AC05 | 12 | 104 | Vitest + MMD docs |
| R12-AC06 | 12 | 21 | template registry |
| R12-AC07 | 12 | 90 | Vitest suppression |
| R12-AC08 | 12 | 90 | Vitest |
| R12-AC09 | 12 | 90 | manual/E2E background |
| R12-AC10 | 12 | 90 | Vitest |
| R12-AC11 | 12 | 90 | E2E hidden tab |
| R12-AC12 | 12 | 106 | E2E suppression |
| R13-AC01 | 13 | 90 | Vitest |
| R13-AC02 | 13 | 89 | Vitest subscribe |
| R13-AC03 | 13 | 28 | delivery_status column |
| R13-AC04 | 13 | 89 | Vitest reconcile |
| R13-AC05 | 13 | 88 | Vitest optimistic |
| R13-AC06 | 13 | 94 | E2E list reorder |
| R13-AC07 | 13 | 95 | virtualize optional |
| R14-AC01 | 14 | 8 | pgTAP idempotency |
| R14-AC02 | 14 | 31 | pgTAP accept race |
| R14-AC03 | 14 | 28 | code review |
| R14-AC04 | 14 | 38 | pgTAP conditional |
| R15-AC01 | 15 | 2 | migration |
| R15-AC02 | 15 | 4 | migration |
| R15-AC03 | 15 | 14 | migration |
| R15-AC04 | 15 | 13 | migration |
| R15-AC05 | 15 | 6 | migration |
| R15-AC06 | 15 | 72 | RLS |
| R15-AC07 | 15 | 9 | audit triggers |
| R16-AC01 | 16 | 96 | Vitest hydrate |
| R16-AC02 | 16 | 96 | Vitest realtime update |
| R16-AC03 | 16 | 96 | component variants |
| R16-AC04 | 16 | 96 | Vitest fallback |
| R16-AC05 | 16 | 96 | Vitest role CTAs |
| R16-AC06 | 16 | 96 | Vitest scroll |
| R16-AC07 | 16 | 96 | Vitest error state |
| R16-AC08 | 16 | 101 | checklist |
| R17-AC01 | 17 | 58 | pgTAP list |
| R17-AC02 | 17 | 94 | component |
| R17-AC03 | 17 | 94 | component preview |
| R17-AC04 | 17 | 94 | unread badge |
| R17-AC05 | 17 | 94 | ellipsis CSS |
| R17-AC06 | 17 | 94 | E2E navigation |
| R17-AC07 | 17 | 94 | E2E empty |
| R17-AC08 | 17 | 100 | ChatsLayout |
| R17-AC09 | 17 | 106 | E2E visual |
| R18-AC01 | 18 | 95 | component layout |
| R18-AC02 | 18 | 95 | header |
| R18-AC03 | 18 | 95 | scroll behavior |
| R18-AC04 | 18 | 95 | message groups |
| R18-AC05 | 18 | 95 | multiline input |
| R18-AC06 | 18 | 92 | composer disabled |
| R18-AC07 | 18 | 92 | composer enabled |
| R18-AC08 | 18 | 106 | E2E keyboard |
| R18-AC09 | 18 | 106 | E2E safe-area |
| R18-AC10 | 18 | 106 | Playwright mobile-safari |
| R19-AC01 | 19 | 93 | component |
| R19-AC02 | 19 | 93 | priority logic |
| R19-AC03 | 19 | 93 | provider CTA |
| R19-AC04 | 19 | 93 | revision CTA |
| R19-AC05 | 19 | 93 | client View Proposal |
| R19-AC06 | 19 | 93 | session dismiss |
| R19-AC07 | 19 | 98 | modal wire |
| R19-AC08 | 19 | 93 | a11y labels |
| R20-AC01 | 20 | 113 | visual QA |
| R20-AC02 | 20 | 113 | proposal CTAs |
| R20-AC03 | 20 | 113 | WCAG audit |
| R20-AC04 | 20 | 113 | toast |
| R20-AC05 | 20 | 94 | skeleton |
| R20-AC06 | 20 | 95 | error state |
| R20-AC07 | 20 | 106 | E2E a11y |
| R21-AC01 | 21 | 9 | audit triggers |
| R21-AC02 | 21 | 66 | Sentry config |
| R21-AC03 | 21 | 67 | analytics events |
| R21-AC04 | 21 | 63 | ops query |
| R21-AC05 | 21 | 68 | alert doc |
| R22-AC01 | 22 | 58 | pgTAP pagination |
| R22-AC02 | 22 | 89 | Realtime |
| R22-AC03 | 22 | 80 | indexes |
| R22-AC04 | 22 | 81 | pgTAP payload |
| R22-AC05 | 22 | 61 | lazy hydrate |
| R23-AC01 | 23 | 31 | pgTAP |
| R23-AC02 | 23 | 31 | API read services |
| R23-AC03 | 23 | 31 | pgTAP rollback |
| R23-AC04 | 23 | 110 | business docs |
| R24-AC01 | 24 | 108 | rollout doc |
| R24-AC02 | 24 | 38 | SLOT_RELEASED event |
| R24-AC03 | 24 | 45 | domain event |
| R24-AC04 | 24 | 110 | docs |
| R24-AC05 | 24 | 108 | future note |
| R24-AC06 | 24 | 110 | docs |
| R24-AC07 | 24 | 110 | docs |
| R25-AC01 | 25 | 38 | pgTAP + cron |
| R25-AC02 | 25 | 39 | pgTAP |
| R25-AC03 | 25 | 40 | pgTAP independence |
| R25-AC04 | 25 | 38 | pgTAP savepoint |
| R25-AC05 | 25 | 64 | job_runs |
| R25-AC06 | 25 | 38 | perf test |
| R25-AC07 | 25 | 38 | pgTAP skip terminal SR |
| R25-AC08 | 25 | 109 | CI |
| R26-AC01 | 26 | 51 | reconcile RPC |
| R26-AC02 | 26 | 49 | janitor |
| R26-AC03 | 26 | 31 | pgTAP |
| R26-AC04 | 26 | 89 | Vitest reconcile |
| R26-AC05 | 26 | 69 | replay idempotency |
| R26-AC06 | 26 | 54 | Deno retry |
| R26-AC07 | 26 | 28 | pgTAP reactivation |
| R27-AC01 | 27 | 45 | domain_events checkout lease |
| R27-AC02 | 27 | 47 | lease janitor |
| R27-AC03 | 27 | 24 | idempotency query |
| R27-AC04 | 27 | 111 | typing TTL |
| R27-AC05 | 27 | 97 | client-only draft |
| R28-AC01 | 28 | 23 | pgTAP outbox |
| R28-AC02 | 28 | 45 | pgTAP consumer |
| R28-AC03 | 28 | 44 | analytics best-effort |
| R28-AC04 | 28 | 38 | optional matching |
| R28-AC05 | 28 | 45 | ordering doc |
| R28-AC06 | 28 | 63 | ops replay query |
| R29-AC01 | 29 | 28 | pgTAP |
| R29-AC02 | 29 | 28 | pgTAP CLOSED |
| R29-AC03 | 29 | 28 | pgTAP slot |
| R29-AC04 | 29 | 108 | docs |
| R29-AC05 | 29 | 28 | code review |
| R29-AC06 | 29 | 28 | pgTAP unique |
| R30-AC01 | 30 | 91 | Vitest poll |
| R30-AC02 | 30 | 45 | consumer skip |
| R30-AC03 | 30 | 96 | Vitest fallback |
| R30-AC04 | 30 | 54 | E2E retry |
| R30-AC05 | 30 | 98 | E2E offline |
| R30-AC06 | 30 | 92 | Vitest 429 |
| R31-AC01 | 31 | 79 | pgTAP RLS |
| R31-AC02 | 31 | 79 | pgTAP admin |
| R31-AC03 | 31 | 31 | pgTAP role |
| R31-AC04 | 31 | 79 | pgTAP |
| R31-AC05 | 31 | 66 | Sentry scrub |
| R31-AC06 | 31 | 56 | refresh RPC |
| R31-AC07 | 31 | 101 | permissions checklist |
| R32-AC01 | 32 | 28 | pgTAP TX boundary |
| R32-AC02 | 32 | 31 | pgTAP |
| R32-AC03 | 32 | 30 | pgTAP |
| R32-AC04 | 32 | 3 | pgTAP slot lock |
| R32-AC05 | 32 | 114 | architecture review |
| R32-AC06 | 32 | 103 | pgTAP |
| R33-AC01 | 33 | 10 | migration seed |
| R33-AC02 | 33 | 28 | pgTAP runtime read |
| R33-AC03 | 33 | 110 | docs matching |
| R33-AC04 | 33 | 10 | pgTAP override |
| R33-AC05 | 33 | 10 | pgTAP fallback |
| R33-AC06 | 33 | 10 | pgTAP clamp |
| R33-AC07 | 33 | 109 | CI pgTAP |
| R33-AC08 | 33 | 110 | docs |
| R33-AC09 | 33 | 110 | ops doc |
| R33-AC10 | 33 | 10 | optional keys |
| R34-AC01 | 34 | 28 | pgTAP 102 |
| R34-AC02 | 34 | 92 | Vitest |
| R34-AC03 | 34 | 96 | E2E card CTAs |
| R34-AC04 | 34 | 33 | pgTAP |
| R34-AC05 | 34 | 28 | pgTAP |
| R34-AC06 | 34 | 30 | pgTAP |
| R34-AC07 | 34 | 34 | pgTAP |
| R34-AC08 | 34 | 32 | pgTAP |
| R34-AC09 | 34 | 28 | pgTAP race |
| R34-AC10 | 34 | 103 | pgTAP |
| R34-AC11 | 34 | 25 | SQL function |
| R34-AC12 | 34 | 28 | pgTAP system msg |
| R34-AC13 | 34 | 30 | pgTAP |
| R34-AC14 | 34 | 102 | pgTAP suite |
| R34-AC15 | 34 | 93 | banner copy |
| R34-AC16 | 34 | 93 | banner |
| R35-AC01 | 35 | 79 | pgTAP |
| R35-AC02 | 35 | 74 | pgTAP |
| R35-AC03 | 35 | 78 | pgTAP deny admin write |
| R35-AC04 | 35 | 77 | Storage RLS |
| R35-AC05 | 35 | 72 | pgTAP |
| R35-AC06 | 35 | 79 | pgTAP |
| R35-AC07 | 35 | 28 | pgTAP participant |
| R35-AC08 | 35 | 73 | pgTAP |
| R35-AC09 | 35 | 79 | pgTAP |
| R35-AC10 | 35 | 30 | pgTAP |
| R35-AC11 | 35 | 72 | migration |
| R35-AC12 | 35 | 73 | policy review |
| R35-AC13 | 35 | 17 | initplan helpers |
| R35-AC14 | 35 | 28 | RPC review |
| R35-AC15 | 35 | 86 | no service_role in app |
| R35-AC16 | 35 | 79 | pgTAP suite |

**Coverage:** 273 AC rows · Tasks 1–114 · See task **114** for OAC gate and CI enforcement.
