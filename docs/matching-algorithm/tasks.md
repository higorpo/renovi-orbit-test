# Implementation Tasks — Renovi Progressive Dispatch & Matching

**Sources:** [`requirements.md`](./requirements.md) · [`design.md`](./design.md) · [`CONTEXT.md`](./CONTEXT.md)  
**Scope:** Requirements 1–13, 4A, 10A, 10B (200 acceptance criteria) · **80 tasks** (1–80)  
**Migration policy:** Net-new timestamped files under `supabase/migrations/` only — SHALL NOT edit shipped migrations.

---

## Execution Strategy

### Implementation approach

Implementation SHALL follow a **database-first, dark-deploy, client-cutover** sequence aligned with design §13.9 migration waves **M1–M15**. PostgreSQL owns dispatch FSM, scheduling, discovery, ranking, visibility, gates, leases, stats aggregates, and MMD ingest enqueue. Edge Functions SHALL remain thin (JWT + RPC proxy + external I/O). Client features SHALL consume Public API layers only (`provider-jobs/api/`, `view-services/api/`, `device-beacon/api/`).

### Execution order

| Wave | Phase | Unblocks |
|------|-------|----------|
| M1–M2 | Foundation + platform constants | All runtime reads of `matching.*` keys |
| M3–M4 | Beacon + `provider_latest_locations` | Geo discovery (Req 3, 9, 12) |
| M5–M6 | Dispatch schema + bootstrap trigger | Dispatch row existence per SR |
| M7 | Ratings/stats schema + triggers | Ranking quality/conversion inputs (Req 4) |
| M8 | Gate helper | CNS integration + cron gate eval |
| M9 | Discovery + ranking SQL | Batch candidate resolution |
| M10 | Lease + open_batch + cron | End-to-end batch progression |
| M11 | MMD trigger + template | Async notification delivery |
| M12–M13 | Feed/audit/rating RPCs + GRANTs | Client + Edge cutover |
| Client | provider-jobs cutover (68–70), device-beacon (66–67), view-services | User-visible feed + geo |
| M14 | CNS RPC patches | Terminal flows + inline gates |
| M15 | Drop legacy feed | Remove `match_provider_jobs` |

### Architectural dependencies

- **Transactional coupling:** Bootstrap (SR OPEN → dispatch row), batch open (visibility + batch rows + MMD ingest), gate eval inline on proposal RPCs, accept/cancel terminal transitions — each MUST be single PostgreSQL transaction.
- **Async boundary:** MMD FCM/Resend delivery MUST NOT block batch txn; ingest row creation MUST be in same txn as `batch_providers` INSERT (transactional outbox via trigger).
- **Cron exclusivity:** Batch discovery, visibility persistence, MMD enqueue SHALL occur **only** in `cron_process_service_request_dispatches()` phase 2 — inline `evaluate_service_request_dispatch_gates` MUST NOT open batches (#107).
- **Single-writer per dispatch:** Lease on `service_request_dispatches` + `FOR UPDATE SKIP LOCKED` phase-2 selection — NOT parallel batch open for same SR.

### Rollout strategy

1. **Dark schema (M1–M7):** Deploy migrations; no client change; existing `match_provider_jobs` remains live.
2. **Backend orchestration (M8–M11):** Dispatches bootstrap on new OPEN SRs; batches run; notifications enqueue; feed RPC exists but unused.
3. **Parallel feed (M12 + Edge):** Ship `list-provider-opportunities`; client behind optional `matching.enabled` platform constant (MAY seed in M1).
4. **Client cutover:** Swap `provider-jobs/api/` to new Edge; add view/dismiss hooks; enable location tracking for providers.
5. **CNS integration (M14):** Wire gates + terminal dispatch on accept/cancel/expire.
6. **Legacy removal (M15):** Drop `match_provider_jobs` + `match-provider-jobs` Edge after validation.

### Validation strategy

- **pgTAP:** Gate ladder, `next_batch_at` rules, idempotent dismiss/view, visibility UNIQUE, discovery exclusions, tie-break ordering.
- **Deno:** Edge auth, suspended → empty feed.
- **Vitest:** Client hooks fire once on mount; API layer contracts.
- **E2E:** Feed cursor stability, dismiss hides card, detail still accessible via link.
- **Failure injection:** Lease expiry recovery, concurrent cron workers, MMD quota exhaustion.

### Risk isolation

- Schema migrations deploy independently of client.
- Feed cutover is reversible until M15 (keep legacy RPC until step 6).
- Cron processes max **50** dispatches/tick — limits blast radius of bad discovery SQL.
- Hardcoded 20 km / pool 200 — no misconfiguration via constants.

### Recovery & rollback

- **Batch txn failure:** Full rollback; retry next 2 min cron tick; no partial visibility.
- **Lease crash:** TTL 300s; recovery within ≤6 min (3 cron periods).
- **Rollback M15:** Re-deploy legacy Edge + restore `match_provider_jobs` from git history (platform reset acceptable per decision #8).

### Critical path tasks

| Category | Tasks |
|----------|-------|
| Observability | 45, 46, 47, 75, 76 |
| Security | 8, 49, 50, 65 |
| Unblock batch flow | 5, 6, 8, 9, 10, 11, 12, 13, 14, 15 |
| Unblock feed | 17–19, 24, 35–38, 68–70 |
| Client geo (batch eligibility) | 66–68, 32–34 |

---

## Phase 1: Database Foundation

### 1. [x] Migration M1 — `platform_constant_numeric` + `matching.*` seeds

Description:
Ship migration `*_matching_platform_constants_seeds.sql` introducing `platform_constant_numeric(p_key text, p_default numeric)` with `GRANT EXECUTE` to `service_role` and `authenticated` (#129). Seed all 22 `matching.*` keys via `INSERT … ON CONFLICT (key) DO UPDATE` — **no DDL** beyond helper (#98, #131). Integer keys continue using `platform_constant_int`.

Responsibilities:
- Create numeric constant reader mirroring `platform_constant_int`.
- Seed dispatch timing, batch size, ranking weights, rating dimension weights, gate thresholds, lease TTL, H3 resolution, load caps.
- Optionally seed `matching.enabled` default `false` for phased rollout.

Implementation Details:
- Fractional keys stored as `'0.40'::jsonb` per #124.
- SHALL NOT seed `matching.beacon_radius_km` or `matching.discovery_candidate_pool_max` — hardcoded in SQL (#126).
- SHALL NOT seed rating edit window — 48 h hardcoded in RPC (#123).

Deliverables:
- `supabase/migrations/*_matching_platform_constants_seeds.sql`
- pgTAP: helper returns default when key missing
- Updated `database.types.ts` via `yarn generate-supabase-types`

Dependencies:
- Existing `platform_constants` table and `platform_constant_int` pattern (CNS seeds)

Runtime Guarantees:
- Idempotent seed via ON CONFLICT DO UPDATE
- Read-stable defaults at RPC invocation time

Failure Handling:
- Migration failure blocks all downstream matching migrations

Observability:
- None at runtime; migration logged in deploy

Security Considerations:
- `authenticated` GRANT on numeric helper — read-only constants

Performance Considerations:
- Constants cached in PG plan cache per connection

Requirements covered:
5, 4, 4A, 10B (config reads)

Acceptance Criteria covered:
4A.2, 5.1, 5.2, 5.14, 10B.1

---

### 2. [x] Migration M2 — `profiles.operational_status` enum + column

Description:
Add PostgreSQL enum `provider_operational_status` (`active`, `suspended`) and column `profiles.operational_status NOT NULL DEFAULT 'active'`. Suspended providers SHALL be excluded from discovery, fallback, and feed (#25).

Responsibilities:
- Define enum type in `public`.
- Add column with default `active` for all existing rows.
- Document admin change mechanism out of MVP (#52).

Implementation Details:
- No admin RPC in MVP — all providers remain `active` until admin tooling ships.
- Discovery and feed RPCs SHALL filter `operational_status = 'active'`.

Deliverables:
- `supabase/migrations/*_matching_profiles_operational_status.sql`
- pgTAP: suspended provider excluded from `matching_discover_candidates` (after Task 28)

Dependencies:
- None

Runtime Guarantees:
- Default `active` preserves current behavior

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- Direct UPDATE of `operational_status` by `authenticated` SHOULD remain blocked (admin-only future)

Performance Considerations:
- Partial index on `(role, operational_status)` MAY be added if discovery plans show seq scan

Requirements covered:
3, 13

Acceptance Criteria covered:
3.2, 13.7

---

## Phase 2: Persistence Layer — Location & Geo Aggregate

### 3. [x] Migration M3 — Extend `user_device_beacons` with location columns

Description:
ALTER `public.user_device_beacons` adding `location_permission_granted boolean NOT NULL DEFAULT false`, `location geography(Point,4326)`, `location_accuracy_meters numeric`, `location_recorded_at timestamptz`.

Responsibilities:
- Extend existing beacon table without breaking FCM sync.
- Preserve `(profile_id, device_id)` uniqueness semantics.

Implementation Details:
- Nullable location columns when permission not granted.
- `updated_at` refresh on upsert (#18 Req 12).

Deliverables:
- `supabase/migrations/*_matching_beacon_location_columns.sql`
- Type regeneration

Dependencies:
- Task 2 (operational_status for client gating — soft)

Runtime Guarantees:
- Backward compatible — existing beacon rows get `location_permission_granted = false`

Failure Handling:
- Migration additive only

Observability:
- N/A

Security Considerations:
- Existing RLS `auth.uid() = profile_id` unchanged (#12.19)

Performance Considerations:
- GIST index on `location` MAY be deferred to M4 aggregate table

Requirements covered:
12

Acceptance Criteria covered:
12.4, 12.16, 12.17, 12.18, 12.19

---

### 4. [x] Migration M4 — `provider_latest_locations` table + beacon upsert trigger

Description:
Create `provider_latest_locations` (1:1 per provider) with GIST + H3 indexes. Implement `AFTER INSERT OR UPDATE` trigger on `user_device_beacons` to upsert aggregate row using **most recent** `location_recorded_at` among devices with `location_permission_granted = true` and valid freshness (#18).

Responsibilities:
- Maintain denormalized operational location for discovery.
- Compute `h3_index` at resolution from `matching.h3_resolution` (default 7).
- Record originating `device_id` on aggregate row.

Implementation Details:
- Trigger runs in same txn as beacon upsert — strong consistency.
- Multi-device: pick max `location_recorded_at` where freshness < `matching.beacon_location_max_age_hours`.
- `SET search_path = public, extensions` on trigger function.

Deliverables:
- `supabase/migrations/*_matching_provider_latest_locations.sql`
- Trigger `trg_user_device_beacon_refresh_provider_location`
- GIST index `provider_latest_locations_location_gist`
- H3 partial index `provider_latest_locations_h3_idx`

Dependencies:
- Task 1 (H3 resolution constant)
- Task 3 (beacon columns)

Runtime Guarantees:
- Eventual consistency beacon → aggregate within single txn
- 1:1 provider_id PK prevents duplicate aggregates

Failure Handling:
- Trigger failure rolls back beacon upsert

Observability:
- Log trigger errors via PG; client sees upsert failure

Security Considerations:
- RLS deny direct `authenticated` access to `provider_latest_locations`

Performance Considerations:
- GIST + H3 pre-filter for discovery (#126)
- Trigger MUST be lightweight — no cross-provider scans

Requirements covered:
1, 3, 9, 12

Acceptance Criteria covered:
1.4, 3.4, 9.1, 9.2, 9.5, 12.5, 12.20

---

## Phase 3: Persistence Layer — Dispatch Schema

### 5. [x] Migration M5 — Dispatch enums, tables, indexes, RLS deny

Description:
Create `service_request_dispatch_status` enum (8 values — no `DISPATCH_EXHAUSTED`, #54), `service_request_dispatch_event_type` enum, and tables: `service_request_dispatches`, `service_request_dispatch_batches`, `service_request_dispatch_batch_providers`, `service_request_provider_visibility`, `service_request_dispatch_events` per design §3.2–3.4b.

Responsibilities:
- Persist dispatch FSM, batch sequence, visibility, audit.
- Enforce UNIQUE constraints for idempotency (I1–I5).
- Deny direct `authenticated` writes on dispatch tables.

Implementation Details:
- `service_request_dispatches`: `UNIQUE(service_request_id)`, lease columns, `batch_sequence`, `fallback_opened_at`, partial indexes on `next_batch_at`, gate re-eval (`PAUSED`/`STOPPED`), lifecycle sweep.
- `service_request_provider_visibility`: partial UNIQUE `(service_request_id, provider_id) WHERE source='batch' AND revoked_at IS NULL` (#114).
- `dispatch_events`: partial UNIQUE for `provider_viewed` and `provider_declined` (#93, #101).
- `batch_providers`: `score_components jsonb`, `ranking_score`, `device_id`.
- `explored_h3_cells jsonb` on batches — audit only (#46).
- RLS: ENABLE + deny policies for `authenticated` on all dispatch tables.

Deliverables:
- `supabase/migrations/*_matching_dispatch_enums_tables.sql`
- All indexes per design §3.8
- pgTAP: constraint violations on duplicate batch visibility

Dependencies:
- Task 1 (constants referenced later)
- Task 2 (operational_status for future discovery)

Runtime Guarantees:
- I1: one dispatch per SR
- I3: one provider_viewed per (SR, provider)
- Append-only `dispatch_events` for authenticated

Failure Handling:
- N/A (schema only)

Observability:
- `dispatch_events` schema ready for audit

Security Considerations:
- RLS deny all direct client access — RPC/trigger only

Performance Considerations:
- Partial indexes reduce cron scan cardinality

Requirements covered:
2, 5, 8, 10A

Acceptance Criteria covered:
2.1, 2.4, 2.5, 8.1, 10A.1, 10A.3

---

### 6. [x] Migration M6 — Service Request dispatch bootstrap trigger

Description:
Implement `trg_service_request_dispatch_bootstrap` on `service_requests` `AFTER INSERT OR UPDATE` when status becomes `OPEN` for the first time — INSERT `service_request_dispatches` (`DISPATCH_PENDING`, `next_batch_at = now() + matching.dispatch_start_delay_minutes`) if no row exists (#60, #99).

Responsibilities:
- Atomic dispatch bootstrap in same txn as SR publication.
- Prevent duplicate dispatch via UNIQUE constraint.

Implementation Details:
- Fire on `INSERT` with `status = OPEN` OR `UPDATE` transitioning to `OPEN`.
- `next_batch_at` from `platform_constant_int('matching.dispatch_start_delay_minutes', 5)`.
- `created_at` starts lifecycle clock (#90).
- INSERT `dispatch_events` type `state_transition` optional in bootstrap or first batch.

Deliverables:
- `supabase/migrations/*_matching_dispatch_bootstrap_trigger.sql`
- Function `trg_fn_service_request_dispatch_bootstrap()`
- pgTAP: first OPEN creates dispatch; second OPEN no-op; concurrent INSERT one winner

Dependencies:
- Task 5 (dispatch table)
- Task 1 (start delay constant)

Runtime Guarantees:
- Exactly one dispatch row per SR (UNIQUE)
- Strong consistency with SR status

Failure Handling:
- SR txn rollback if bootstrap fails

Observability:
- `dispatch_events` on bootstrap (optional payload `bootstrap: true`)

Security Considerations:
- Trigger runs as definer — not client-invokable

Performance Considerations:
- Single row INSERT per SR — negligible

Requirements covered:
1, 2, 5, 10B

Acceptance Criteria covered:
1.1, 2.1, 5.1, 10B.1

---

### 7. [x] Migration M7 — Ratings schema, stats tables, bootstrap + refresh triggers

Description:
Create `service_ratings`, `provider_rating_stats`, `provider_proposal_stats` per design §3.6. Implement bootstrap triggers on `profiles` when `role = provider` (#122, #130). Implement `AFTER INSERT/UPDATE/DELETE` on `service_ratings` → refresh rating stats (#127). Implement `AFTER UPDATE` on `provider_proposals` terminal transitions → refresh proposal stats (#132).

Responsibilities:
- Persist multidimensional ratings per `contracted_service_id` UNIQUE.
- Denormalize ranking inputs for discovery.
- Bootstrap default quality 5.0 and conversion 0.5 neutral.

Implementation Details:
- `overall_score` NOT generated — computed in RPC only (#121).
- `ranking_quality_score` = 5.0 when `rating_count < matching.rating_min_count_for_ranking`.
- `ranking_conversion_score` = 0.5 when `resolved_count < matching.conversion_min_resolved_for_ranking`.
- Conversion window: 90 days; terminal statuses ACCEPTED, REJECTED, REJECTED_AUTOMATICALLY, EXPIRED.
- RLS: deny INSERT/UPDATE `service_ratings` for `authenticated`; SELECT client own (#125); SELECT provider own received; public aggregates on `provider_rating_stats` (#71).

Deliverables:
- `supabase/migrations/*_matching_rating_stats_schema.sql`
- Functions `matching_refresh_provider_rating_stats`, `matching_refresh_provider_proposal_stats`
- pgTAP: bootstrap on provider create; trigger refresh on rating insert

Dependencies:
- Task 1 (weight constants, min count thresholds)
- Task 2 (profiles table)

Runtime Guarantees:
- Stats strong consistency within rating/proposal txn
- I4, I5 invariants

Failure Handling:
- Trigger failure rolls back parent mutation

Observability:
- `updated_at` on stats rows

Security Considerations:
- RLS on `service_ratings`; public read only aggregates

Performance Considerations:
- Per-provider refresh — O(1) per mutation, not full table scan

Requirements covered:
4, 4A, 7, 11

Acceptance Criteria covered:
4.10–4.17, 11.4

---

## Phase 4: Core Transactional Logic — Gate Evaluation

### 8. [x] Migration M8 — `evaluate_service_request_dispatch_gates` RPC

Description:
Implement `evaluate_service_request_dispatch_gates(p_service_request_id uuid)` as `SECURITY DEFINER` plpgsql per design §13.7. Function SHALL implement gate ladder: `STOPPED` > `PAUSED` > `FALLBACK` > `ACTIVE` (#82). MUST no-op on terminal states (#86). MUST NOT open batches (#107).

Responsibilities:
- Compute `pending + REVISION_REQUESTED` proposal count vs `chats.max_active_slots_per_service_request`.
- Compute active chats (≥1 message in `matching.dispatch_active_chat_window_hours`).
- Apply `next_batch_at` rules (#106–#109).
- Emit `state_transition` dispatch_events on status change.

Implementation Details:
- `SELECT … FOR UPDATE` on dispatch row.
- `v_slot_cap` from `platform_constant_int('chats.max_active_slots_per_service_request', 4)`.
- Enter STOPPED/PAUSED/FALLBACK → `next_batch_at = NULL`.
- Resume ACTIVE from STOPPED/PAUSED → `next_batch_at = now()`.
- `fallback_opened_at` NOT cleared when STOPPED/PAUSED override FALLBACK status (#85).
- `SET search_path = public`.

Deliverables:
- `supabase/migrations/*_matching_gate_helper.sql`
- pgTAP: full ladder matrix (STOPPED beats PAUSED; FALLBACK when `fallback_opened_at` set; terminal no-op; resume sets `now()`)

Dependencies:
- Task 5 (dispatch table)
- Task 1 (gate constants)

Runtime Guarantees:
- Exactly-once effect per invocation within txn
- Terminal immutability (#86)

Failure Handling:
- Exception propagates to caller txn rollback

Observability:
- `dispatch_events.state_transition` with `{from, to}` payload

Security Considerations:
- `GRANT EXECUTE` to `service_role` only — not direct client

Performance Considerations:
- Indexed counts on proposals/chats — verify EXPLAIN on gate eval

Requirements covered:
5, 10A

Acceptance Criteria covered:
5.14–5.18, 5.29, 5.33–5.36, 10A.4, 10A.5

---

## Phase 5: Discovery & Ranking Engine

### 9. [x] Migration M9a — `matching_discover_candidates` function

Description:
Implement `matching_discover_candidates(p_service_request_id, p_limit default 200)` per design §15.1. Hardcode **20 km** `ST_DWithin` and pool cap **200** (#126). UNION beacon-eligible (GPS path) and neighborhood-exact-match path (#4 CONTEXT).

Responsibilities:
- Exclude batch-notified providers via visibility `source='batch'` (#114).
- Filter `operational_status = active`, load cap, offered service.
- H3 ring pre-filter (resolution 7, k=1..N cells around SR `h3_index`) then PostGIS `ST_DWithin` refine — SHALL NOT rely on H3 cell membership alone (#3.10, design §9.1).
- ORDER BY distance ASC; LIMIT 200.
- Service eligibility via `provider_offered_services.service_id` match; specialty/subcategory auxiliary tables SHALL be joined when schema exists (Req 3.12) — until then `service_id` is the enforcement surface.

Implementation Details:
- Implement helper `matching_h3_ring_cells(p_h3_index bigint, p_resolution int)` for coarse pre-filter before GIST.
- Freshness: `location_recorded_at >= now() - matching.beacon_location_max_age_hours`.
- Load: `PENDING_PAYMENT` contracted_services with complete schedule intersecting lookforward window; NULL schedules excluded (#23).
- Neighborhood branch: `provider_service_area_neighborhoods` exact match; excludes providers already in beacon branch.
- `STABLE SECURITY DEFINER`; `search_path = public, extensions`.
- Return `provider_id`, `distance_meters`, `has_valid_beacon`, `device_id`.

Deliverables:
- SQL function in `*_matching_discovery_ranking.sql`
- pgTAP: exclusion of batch-visible; 20km boundary; neighborhood fallback; load cap; suspended excluded

Dependencies:
- Task 4 (`provider_latest_locations`)
- Task 5 (visibility table)
- Task 1, 2

Runtime Guarantees:
- Read committed snapshot at invocation
- Deterministic ordering for same inputs

Failure Handling:
- Empty set valid — triggers pool exhaustion in open_batch

Observability:
- EXPLAIN ANALYZE baseline in CI

Security Considerations:
- Internal function — no client GRANT

Performance Considerations:
- GIST + H3; avoid seq scan on `provider_latest_locations`
- `p_limit` clamped `least(greatest(p_limit,1), 200)`

Requirements covered:
1, 3, 9

Acceptance Criteria covered:
1.2, 1.6–1.7, 3.1–3.18, 9.1–9.4

---

### 10. [x] Migration M9b — `matching_rank_candidates` function

Description:
Implement `matching_rank_candidates(p_service_request_id, p_candidates uuid[])` per design §15.2. Compose primary score from proximity (40%), quality (35%), conversion (25%). Apply secondary modifiers (Req 7) and no-beacon penalty (#9 CONTEXT). Deterministic tie-break: exposure count ASC, `provider_id` ASC (#113).

Responsibilities:
- Normalize inputs 0..1 (#4A.1).
- Read weights from `platform_constant_numeric`.
- Persist-decomposable `score_components` jsonb for audit (#4A.7).
- Cap exploration boost at `matching.ranking_exploration_max_boost`.
- Apply exploration boost ONLY when provider passes minimum operational quality/conversion thresholds (Req 4A AC5) — e.g. `quality/5.0 >= 0.4 AND conversion >= 0.35` before `LEAST(exploration_boost, max_boost)`.

Implementation Details:
- `proximity_norm = 0` when no valid beacon; apply `(1 - no_beacon_penalty)` multiplier.
- Quality from `provider_rating_stats.ranking_quality_score` (default 5.0).
- Conversion from `provider_proposal_stats.ranking_conversion_score` (default 0.5).
- Secondary: `inactivity_boost`, `recent_completion_penalty`, `recent_batch_penalty`, `recent_batch_boost`, `exposure_penalty`.
- `ORDER BY ranking_score DESC, exposure_count ASC, provider_id ASC`.

Deliverables:
- SQL function in same migration as Task 9
- pgTAP: tie-break ordering; no-beacon penalty; score_components keys present

Dependencies:
- Task 9 (discover returns candidate metadata)
- Task 7 (stats tables)

Runtime Guarantees:
- Deterministic ranking for same inputs

Failure Handling:
- Empty candidate array returns empty set

Observability:
- `score_components` available for batch_providers INSERT

Security Considerations:
- Internal only

Performance Considerations:
- Batch stats lookups per candidate — acceptable for pool ≤200

Requirements covered:
4, 4A, 7

Acceptance Criteria covered:
4.1–4.9, 4A.1–4A.7, 7.1–7.9, 3.19

---

## Phase 6: Scheduling Engine & Lease Coordination

### 11. [x] Migration M10a — `matching_acquire_dispatch_lease` / `matching_release_dispatch_lease`

Description:
Implement lease CAS functions on `service_request_dispatches`. Acquire when `lease_expires_at IS NULL OR lease_expires_at < now()`. Set `lease_owner = 'matching_cron:' || job_run_id`, `lease_expires_at = now() + matching.dispatch_lease_seconds` (default 300).

Responsibilities:
- Single-writer semantics per dispatch row (#10A.6).
- Release lease on success or txn end.
- Embed `job_run_id` for correlation (#10.2).

Implementation Details:
- `UPDATE … WHERE id = p_dispatch_id AND (lease_expires_at IS NULL OR lease_expires_at < now()) RETURNING *`.
- Release: `SET lease_owner = NULL, lease_expires_at = NULL`.
- TTL 5 min < 3× cron period for zombie recovery (#6.3).

Deliverables:
- Functions in `*_matching_open_batch_and_cron.sql`
- pgTAP: concurrent acquire — one winner; expired lease re-acquire

Dependencies:
- Task 5 (lease columns)
- Task 1 (lease seconds constant)
- Existing `job_run_begin` / `job_run_finish` helpers

Runtime Guarantees:
- At-most-one active lease holder per dispatch
- Lease recovery after TTL (#10A.8, #10A.9)

Failure Handling:
- Failed acquire → skip dispatch this tick (another worker owns)

Observability:
- `lease_owner` encodes `job_run_id`

Security Considerations:
- `service_role` / postgres only

Performance Considerations:
- Single-row UPDATE — O(1)

Requirements covered:
10, 10A, 10B

Acceptance Criteria covered:
10A.6–10A.9, 10B.3

---

### 12. [x] Migration M10b — `matching_open_batch` orchestration RPC

Description:
Implement `matching_open_batch(p_dispatch_id uuid)` — single transaction: acquire lease → `evaluate_service_request_dispatch_gates` → discovery → rank → if zero candidates pool exhaustion → else insert batch, visibility, batch_providers, schedule `next_batch_at`, transition PENDING→ACTIVE on batch #1 (#61).

Responsibilities:
- Orchestrate discovery → rank → top `matching.batch_size` providers.
- INSERT `service_request_dispatch_batches` with `batch_number = batch_sequence + 1`.
- INSERT `service_request_provider_visibility` (`source='batch'`, `granted_at=now()`).
- INSERT `service_request_dispatch_batch_providers` with scores.
- Pool exhaustion: `DISPATCH_FALLBACK_OPEN_MARKET`, `fallback_opened_at`, `next_batch_at=NULL`, event `pool_exhausted` (#21).
- Partial batch 1..9 providers OK (#111).
- After success while ACTIVE: `next_batch_at = now() + batch_interval` (#110).

Implementation Details:
- `FOR UPDATE` dispatch row at start.
- Gates BEFORE discovery (#112).
- Skip open if status not PENDING/ACTIVE after gate eval.
- `batch_sequence` increment atomically.
- `explored_h3_cells` jsonb audit on batch row — populate via `matching_compute_explored_h3_cells(sr_h3_index)` during discovery (Task 64); audit-only, SHALL NOT affect future eligibility (Req 2 AC5).
- Optional `pg_advisory_xact_lock(hashtext(sr_id::text))` (#7.4); add in Task 79 if Task 54 load test shows double-batch.
- MMD trigger fires on `batch_providers` INSERT (Task 15).
- On discovery `statement_timeout`: catch in `matching_process_dispatch_row`, call `job_run_abort` pattern, release lease — retry next cron tick (design §8.1).

Deliverables:
- `matching_open_batch` function
- `matching_process_dispatch_row` helper
- pgTAP: batch #1 PENDING→ACTIVE; partial batch; pool exhaustion; visibility UNIQUE idempotency; `explored_h3_cells` non-null on beacon path

Dependencies:
- Tasks 8, 9, 10, 11, 15, 64

Runtime Guarantees:
- Atomic batch open — all or nothing (I6)
- At-most-once visibility per provider per SR

Failure Handling:
- Txn rollback → no partial visibility; retry next cron tick (#10A.10)

Observability:
- `dispatch_events.batch_opened`, `pool_exhausted`

Security Considerations:
- Internal only

Performance Considerations:
- Bounded: pool 200, batch 10
- `statement_timeout` SHOULD be set on cron session

Requirements covered:
1, 2, 5, 6, 8, 10A

Acceptance Criteria covered:
1.8–1.9, 2.2–2.7, 5.1–5.13, 5.21–5.22, 5.37–5.38, 6.1, 6.6, 8.2, 8.5, 10A.1–10A.4

---

### 13. [x] Migration M10c — `cron_process_service_request_dispatches` + pg_cron job

Description:
Implement two-phase cron worker per design §6.2, §13.9. Register `pg_cron` job `matching_process_service_request_dispatches` every `*/2 * * * *`. Wrap with `job_run_begin` / `job_run_finish`.

Responsibilities:
- **Phase 1:** Lifecycle sweep — mass `DISPATCH_EXPIRED` where `created_at + lifecycle_hours < now()` (#91, #103); for each expired row INSERT `service_request_dispatch_events` with `event_type = 'dispatch_expired'` and payload `{ expired_at, lifecycle_hours }` (Req 8 AC1, #70).
- **Phase 2a:** Due `next_batch_at` rows — `FOR UPDATE SKIP LOCKED` LIMIT 50 → `matching_process_dispatch_row`.
- **Phase 2b:** `PAUSED`/`STOPPED` gate-only pass — lease + `evaluate_service_request_dispatch_gates` — no batch open (#104).

Implementation Details:
- Phase 1 independent of `next_batch_at` (#91); set `next_batch_at = NULL` on expired rows.
- Phase 2a: `status IN (PENDING, ACTIVE)` AND `next_batch_at <= now()`.
- Phase 2b: `status IN (PAUSED, STOPPED)` ordered by `updated_at`.
- Gate eval before discovery in 2a (#112).
- `job_name` constant for `job_runs` telemetry.

Deliverables:
- `cron_process_service_request_dispatches()` function
- pg_cron schedule migration
- pgTAP: phase 1 expiration; phase 2 skip when gate → STOPPED; SKIP LOCKED concurrency

Dependencies:
- Tasks 8, 11, 12
- `job_run_begin` / `job_run_finish` (existing)

Runtime Guarantees:
- Resumable from persisted state (#10B.4)
- Max 50 dispatches/tick — remaining due next tick

Failure Handling:
- `job_run_finish` with error; txn rollback per dispatch
- Stuck lease recovery via TTL

Observability:
- `job_runs` row per invocation
- Metrics: phase1_expired_count, phase2a_processed, phase2b_processed

Security Considerations:
- Executed as postgres — not client-callable

Performance Considerations:
- SKIP LOCKED enables horizontal cron safety
- 2 min cadence — no sub-minute polling (#10B.6)

Requirements covered:
5, 10, 10B

Acceptance Criteria covered:
5.23, 5.30–5.31, 5.39, 10.2–10.7, 10B.2–10B.6

---

## Phase 7: Async Orchestration — Message Dispatcher

### 14. [x] Migration M11a — MMD template seed `matching.new_opportunity`

Description:
Seed `message_dispatcher.message_templates` for key `matching.new_opportunity` on channels `push` and `email` with variables: `service_request_id`, `title`, `service_name`, `neighborhood`, `urgency`, `deep_link_path` — NO `distance_km` (#44, #45).

Responsibilities:
- Push body template (concise).
- Email subject/body template (PT-BR product copy).
- `ON CONFLICT (key, channel) DO UPDATE` for idempotent deploy.

Implementation Details:
- `bypass_limits` NOT applicable at template level — enforced at ingest.
- `deep_link_path` format consistent with app routing.

Deliverables:
- Template INSERT in `*_matching_mmd_batch_notification_trigger.sql`
- Manual verification in MMD admin/staging

Dependencies:
- Existing `message_dispatcher` schema

Runtime Guarantees:
- Template idempotent deploy

Failure Handling:
- Migration failure blocks trigger deploy

Observability:
- Template key searchable in MMD audit

Security Considerations:
- No PII beyond SR metadata in variables

Performance Considerations:
- N/A

Requirements covered:
6

Acceptance Criteria covered:
6.7

---

### 15. [x] Migration M11b — `trg_matching_batch_provider_notify` AFTER INSERT trigger

Description:
Implement `AFTER INSERT ON service_request_dispatch_batch_providers FOR EACH ROW` trigger calling `message_dispatcher.message_dispatcher_ingest` for **both** `push` and `email` with `bypass_limits := false` (#6.2).

Responsibilities:
- Enqueue MMD ingest in same txn as batch provider row.
- Idempotency key: `dispatch:{sr_id}:batch:{batch_number}:provider:{provider_id}:{channel}`.
- Resolve SR metadata (title, service_name, neighborhood, urgency) for template variables.

Implementation Details:
- Join batch → dispatch → service_request for metadata.
- Two ingest calls per row (push + email).
- MMD `idempotency_key` UNIQUE prevents duplicate on retry (#R3).
- Ingest failure rolls back **entire batch txn** — acceptable; retry next cron (#8.1).

Deliverables:
- Trigger function `trg_fn_matching_batch_provider_notify`
- pgTAP: insert batch_provider creates 2 MMD rows with correct keys

Dependencies:
- Task 14 (template)
- Task 12 (batch_providers INSERT path)
- `message_dispatcher_ingest` RPC (existing)

Runtime Guarantees:
- At-least-once trigger fire; exactly-once MMD row per key
- Visibility granted even if push quota exhausted later (#12)

Failure Handling:
- PG exception → batch txn rollback → no orphaned visibility without MMD attempt

Observability:
- Correlate via idempotency_key in `message_dispatches`

Security Considerations:
- Trigger runs as definer into `message_dispatcher` schema

Performance Considerations:
- 2 ingest RPCs per provider per batch — max 20 per batch

Requirements covered:
6

Acceptance Criteria covered:
6.1–6.6, 6.8

---

### 16. [x] Helper `matching_cancel_pending_mmd_for_service_request`

Description:
Implement helper to cancel QUEUED/PROCESSING MMD dispatches for a service_request matching template prefix `matching.` — used by `accept_proposal` and `cancel_service_request` (#15.7).

Responsibilities:
- Cancel pending batch notifications on match/cancel.
- Idempotent — no error if none pending.

Implementation Details:
- Update `message_dispatcher.message_dispatches` status to CANCELLED where correlation matches SR.
- Called inside same txn as dispatch terminal transition.

Deliverables:
- SQL function (in M14 migration or M11)
- pgTAP: pending rows cancelled; terminal rows untouched

Dependencies:
- MMD schema

Runtime Guarantees:
- Atomic with accept/cancel txn

Failure Handling:
- Propagate exception to rollback terminal transition

Observability:
- MMD audit shows cancellation

Security Considerations:
- Internal only

Performance Considerations:
- Index on correlation fields if exists in MMD schema

Requirements covered:
5, 6

Acceptance Criteria covered:
5.19, 5.20, 6.3

---

## Phase 8: APIs & RPCs — Feed, Audit, Ratings

### 17. [x] Migration M12a — `list_provider_opportunities` RPC (batch arm + exclusions)

Description:
Implement feed RPC batch visibility arm: JOIN `service_request_provider_visibility` WHERE `provider_id = p_provider_id`, `source='batch'`, `revoked_at IS NULL`, `dismissed_at IS NULL`. Apply proposal/chat/prior-proposal exclusions (#95, #96). Handle EXPIRED dispatch — batch visibility persists (#66).

Responsibilities:
- Return empty for `operational_status = suspended` (#13.7).
- Exclude MATCHED/CANCELLED revoked visibility.
- `NOT EXISTS` in-flight proposal, ACTIVE chat, any prior proposal row.

Implementation Details:
- `SECURITY DEFINER`; validate `p_provider_id` matches `auth.uid()` when called from client; Edge uses service_role with pre-validated JWT.
- Return fields: `service_request_id`, `title`, `service_name`, `neighborhood`, `urgency`, `granted_at`, `distance_km`, `active_chat_count_24h`, `source`.

Deliverables:
- Partial RPC in `*_matching_feed_audit_rpcs.sql`
- pgTAP: exclusions; suspended empty; EXPIRED batch visible

Dependencies:
- Task 5 (visibility table)
- Task 1 (chat window constant)

Runtime Guarantees:
- Read committed snapshot
- Stable exclusion semantics

Failure Handling:
- Invalid provider → empty or raise per convention

Observability:
- Log slow queries > 800ms

Security Considerations:
- Provider-scoped reads only

Performance Considerations:
- Use `srv_visibility_feed_idx`
- Semi-join exclusions — verify indexes on proposals/chats

Requirements covered:
5, 13

Acceptance Criteria covered:
5.7–5.8, 5.24–5.28, 13.1, 13.6–13.7, 13.12

---

### 18. [x] Migration M12b — `list_provider_opportunities` fallback arm + UNION

Description:
Add lazy fallback arm: JOIN `service_request_dispatches` WHERE `fallback_opened_at IS NOT NULL` AND status != `EXPIRED`; neighborhood + service match; NOT EXISTS batch visibility; NOT EXISTS fallback dismiss row (#75). UNION with batch arm.

Responsibilities:
- Include fallback when status is FALLBACK, STOPPED, or PAUSED (#85).
- `granted_at` for fallback rows = `fallback_opened_at`.
- EXPIRED → no lazy fallback (#66).

Implementation Details:
- Exact neighborhood via `provider_service_area_neighborhoods`.
- Service match via `provider_offered_services`.
- `source = 'fallback'` in response.

Deliverables:
- Extended RPC in same migration as Task 17
- pgTAP: fallback visible when `fallback_opened_at` set; hidden after EXPIRED for lazy-only

Dependencies:
- Task 17

Runtime Guarantees:
- No bulk visibility INSERT at pool exhaustion

Failure Handling:
- N/A

Observability:
- Track fallback arm row counts in EXPLAIN

Security Considerations:
- Provider neighborhood data scoped to self

Performance Considerations:
- Semi-join dispatch table with neighborhood filter first

Requirements covered:
5, 13

Acceptance Criteria covered:
5.21, 5.24–5.27, 13.1

---

### 19. [x] Migration M12c — `list_provider_opportunities` sort modes + cursor pagination

Description:
Implement sort modes `newest`, `nearest`, `least_competitive` with opaque base64url cursor per mode (#59). Default `newest`; `nearest` requires lat/lng; keyset pagination `limit` default 20 max 50 (#58).

Responsibilities:
- Encode/decode cursor: `{sort, k1, sr_id}`.
- `newest`: `(granted_at DESC, service_request_id)`.
- `nearest`: `(distance_km ASC, service_request_id)` — compute distance from `p_lat`/`p_lng` when provided (#48).
- `least_competitive`: `(active_chat_count_24h ASC, service_request_id)` (#72).
- Return `{items, next_cursor, has_more}` jsonb.

Implementation Details:
- Invalid cursor → SQLSTATE 22023 / mapped to 400 at Edge.
- Sort change invalidates cursor (client responsibility).
- `distance_km` display only — NOT filter (#48).
- GPS does not filter opportunities out (#13.3).

Deliverables:
- Cursor helper functions `matching_encode_feed_cursor`, `matching_decode_feed_cursor`
- pgTAP: keyset stability; invalid cursor error; sort mode keys

Dependencies:
- Tasks 17, 18

Runtime Guarantees:
- Keyset pagination — no duplicate/skip within sort order under stable visibility (#13.9)

Failure Handling:
- Bad cursor → client 400

Observability:
- p95 latency metric

Security Considerations:
- Cursor not auth-bearing

Performance Considerations:
- Avoid OFFSET; use keyset WHERE clauses

Requirements covered:
13

Acceptance Criteria covered:
13.3–13.5, 13.8–13.11

---

### 20. [x] Migration M12d — `record_provider_opportunity_view` RPC

Description:
Implement idempotent audit RPC. Provider-only. INSERT `dispatch_events` `provider_viewed` ON CONFLICT DO NOTHING via partial UNIQUE (#93). Always return `{success: true}`.

Responsibilities:
- No side effects in `get_service` (#92).
- At most one event per (SR, provider) in MVP.

Implementation Details:
- `auth.uid()` must be provider role.
- `INSERT … ON CONFLICT DO NOTHING` on partial unique index.
- Fire-and-forget safe for client.

Deliverables:
- RPC in `*_matching_feed_audit_rpcs.sql`
- pgTAP: double call single row; non-provider rejected

Dependencies:
- Task 5 (dispatch_events)

Runtime Guarantees:
- Idempotent (#93)

Failure Handling:
- Client logs warning; no retry storm

Observability:
- `provider_viewed` events for funnel analytics

Security Considerations:
- Self-only — `provider_id = auth.uid()`

Performance Considerations:
- Single INSERT — O(1)

Requirements covered:
8, 11, 13

Acceptance Criteria covered:
8.3, 11.1–11.3, 13.14–13.15

---

### 21. [x] Migration M12e — `dismiss_provider_opportunity` RPC

Description:
Implement feed-only dismiss RPC (#100). Batch visibility → UPDATE `dismissed_at`. Fallback-only → INSERT visibility `source='fallback_dismiss'`, `dismissed_at=now()` (#75). INSERT `provider_declined` event ON CONFLICT DO NOTHING (#101).

Responsibilities:
- Idempotent re-call returns success no-op.
- SHALL NOT block `get_service` or CNS actions (#102).
- SHALL NOT affect batch eligibility beyond prior notification (#19).

Implementation Details:
- `FOR UPDATE` visibility row when exists.
- Lazy fallback eligibility check for insert path.
- No dismiss from detail screen — client enforces (#117).

Deliverables:
- RPC + pgTAP idempotency tests

Dependencies:
- Task 5

Runtime Guarantees:
- Idempotent (#101)
- Feed-only effect

Failure Handling:
- N/A

Observability:
- `provider_declined` events

Security Considerations:
- Provider self-only

Performance Considerations:
- Single row mutation

Requirements covered:
8, 13

Acceptance Criteria covered:
8.4, 13.20–13.21

---

### 22. [x] Migration M13a — `submit_service_rating` RPC

Description:
RPC-only write path for client ratings. Verify `contracted_services.status = COMPLETED` AND `client_id = auth.uid()` (#133). Reject duplicate per `contracted_service_id` (#128). Compute `overall_score` from dimension weights in `platform_constants` (#121).

Responsibilities:
- Persist four dimension scores 1–5.
- Optional comment.
- Stats refresh via trigger — NOT inline (#127).

Implementation Details:
- `FOR UPDATE` contracted_service row.
- Weights: quality 40%, punctuality 25%, communication 20%, value 15%.
- `SECURITY DEFINER`; `search_path = public`.

Deliverables:
- `*_matching_rating_rpcs.sql`
- pgTAP: happy path; duplicate reject; wrong client reject; incomplete CS reject

Dependencies:
- Task 7 (schema + triggers)
- Task 1 (dimension weights)

Runtime Guarantees:
- UNIQUE per contracted_service
- Strong consistency stats in same txn

Failure Handling:
- Explicit error codes for client toasts

Observability:
- Rating submit audit via `service_ratings.submitted_at`

Security Considerations:
- Client-only write via RPC; RLS denies direct INSERT

Performance Considerations:
- Single row INSERT

Requirements covered:
4

Acceptance Criteria covered:
4.12, 4.15

---

### 23. [x] Migration M13b — `update_service_rating` RPC

Description:
Allow edit within **48 hours hardcoded** after `submitted_at` (#123, #134). Reject after window — immutable, no admin override. Recompute `overall_score`.

Responsibilities:
- Verify `client_id = auth.uid()`.
- Same dimension validation as submit.

Implementation Details:
- `now() > submitted_at + interval '48 hours'` → raise exception.
- `FOR UPDATE` rating row.

Deliverables:
- RPC in same migration as Task 22
- pgTAP: edit within window OK; after 48h reject

Dependencies:
- Task 22

Runtime Guarantees:
- Immutability after window

Failure Handling:
- Clear error message for expired edit window

Observability:
- `updated_at` on rating row

Security Considerations:
- Owner client only

Performance Considerations:
- N/A

Requirements covered:
4

Acceptance Criteria covered:
4.12, 4.15

---

## Phase 9: Edge Functions

### 24. [x] Edge Function `list-provider-opportunities`

Description:
Create `supabase/functions/list-provider-opportunities/index.ts` mirroring `match-provider-jobs` pattern per design §5.3, §13.11.

Responsibilities:
- JWT validation via `auth.getUser()`.
- Reject non-provider; `operational_status = suspended` → empty feed without RPC or empty RPC result.
- Parse `sort_mode`, `cursor`, `limit` (clamp 1–50), optional `lat`/`lng`.
- Call `supabaseAdmin.rpc('list_provider_opportunities', { p_provider_id: user.id, … })`.
- Return JSON as-is; target < 2s.

Implementation Details:
- CORS headers consistent with existing Edge functions.
- Optional rate limit 60 req/min/user — fail-open on DB error (#9.5).
- Deno tests: 401 without JWT; empty for suspended.

Deliverables:
- `supabase/functions/list-provider-opportunities/index.ts`
- `supabase/functions/list-provider-opportunities/index.test.ts`
- Deploy config in `supabase/config.toml`

Dependencies:
- Tasks 17–19 (RPC deployed)

Runtime Guarantees:
- Stateless; read-only orchestration

Failure Handling:
- 504 on timeout; client TanStack retry

Observability:
- `x-request-id` logging
- Sentry on 5xx

Security Considerations:
- service_role for RPC; JWT binds provider_id

Performance Considerations:
- No extra enrichment round-trips

Requirements covered:
13

Acceptance Criteria covered:
13.2, 13.7

---

### 25. [x] Verify MMD worker handles `matching.new_opportunity` template

Description:
Confirm existing `message-dispatcher-worker` renders `matching.new_opportunity` for push (FCM) and email (Resend). Add integration test or staging checklist if template variables missing.

Responsibilities:
- Template variable substitution.
- Quota enforcement `bypass_limits=false`.
- Terminal states `no_push_targets`, quota exceeded.

Implementation Details:
- No code change if MMD generic — document staging validation steps.
- If gap: add template to worker allowlist.

Deliverables:
- Staging validation checklist
- Optional Deno test with mocked FCM/Resend

Dependencies:
- Tasks 14, 15

Runtime Guarantees:
- At-least-once delivery; MMD backoff

Failure Handling:
- Per MMD spec — visibility already granted

Observability:
- `message_dispatcher_audit` delivery ratio dashboard (#10.3)

Security Considerations:
- MMD existing auth on worker

Performance Considerations:
- Existing MMD checkout crons unchanged

Requirements covered:
6

Acceptance Criteria covered:
6.2, 6.4–6.5, 6.8

---

## Phase 10: CNS Integration

### 26. [x] Migration M14a — Patch `create_provider_proposal` for STOPPED gate

Description:
At end of `create_provider_proposal` txn: call `evaluate_service_request_dispatch_gates(sr_id)`. Reject new proposal when dispatch `status = DISPATCH_STOPPED` (#78, #88). Count `PENDING + REVISION_REQUESTED` vs `chats.max_active_slots_per_service_request`.

Responsibilities:
- Global proposal cap enforcement including direct link (#13.19).
- Inline gate only — no batch open (#107).

Implementation Details:
- Check dispatch status after existing CNS validations.
- Raise structured exception for STOPPED.

Deliverables:
- Patch migration `*_matching_integrate_cns_dispatch.sql`
- pgTAP: 4th proposal blocked; gate eval invoked

Dependencies:
- Task 8

Runtime Guarantees:
- Strong consistency with proposal INSERT

Failure Handling:
- Proposal rejected — no partial state

Observability:
- Gate transition events on threshold cross

Security Considerations:
- Existing CNS auth unchanged

Performance Considerations:
- One extra gate eval per proposal

Requirements covered:
5, 13

Acceptance Criteria covered:
5.16–5.18, 13.16, 13.19

---

### 27. [x] Migration M14b — Patch proposal revision/accept/reject RPCs for inline gates

Description:
Append `evaluate_service_request_dispatch_gates(service_request_id)` to: `request_proposal_revision`, revision response/decline flows, `accept_proposal` (before match terminal), `reject_proposal`, `reject_proposal_automatically` — same txn (#83).

Responsibilities:
- Immediate gate re-eval on proposal count changes.
- `accept_proposal` also performs dispatch terminal (Task 28).

Implementation Details:
- Gate call at END of each RPC after mutations.
- Terminal dispatch states → gate no-op.

Deliverables:
- CNS RPC patches in M14 migration
- pgTAP per RPC

Dependencies:
- Task 8

Runtime Guarantees:
- Inline strong consistency (#105 for expire job separate)

Failure Handling:
- Rollback on gate failure

Observability:
- `state_transition` events

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
5

Acceptance Criteria covered:
5.18, 5.32

---

### 28. [x] Migration M14c — Patch `accept_proposal` for `DISPATCH_MATCHED` terminal

Description:
Extend `accept_proposal` inline: `status = DISPATCH_MATCHED`, revoke `service_request_provider_visibility` for non-winning providers (`revoked_at = now()`), call `matching_cancel_pending_mmd_for_service_request` (#64, #32).

Responsibilities:
- Atomic with existing CNS cascade (SR COMPLETED, close chats, contracted_service).
- `FOR UPDATE` dispatch row.

Implementation Details:
- Winner provider visibility MAY remain or revoke per product — non-winners MUST revoke for feed hide.
- No separate trigger on `provider_proposals`.

Deliverables:
- Patch in M14 migration
- pgTAP: match terminal; visibility revoked; MMD cancelled

Dependencies:
- Tasks 8, 16

Runtime Guarantees:
- Terminal immutability after MATCHED

Failure Handling:
- Full txn rollback on any step failure

Observability:
- `state_transition` to MATCHED

Security Considerations:
- Client-only accept unchanged

Performance Considerations:
- Batch visibility UPDATE by SR id

Requirements covered:
5, 8

Acceptance Criteria covered:
5.19, 8.6

---

### 29. [x] Migration M14d — Patch `cancel_service_request` for `DISPATCH_CANCELLED`

Description:
Inline: `DISPATCH_CANCELLED`, revoke feed visibility (batch rows), cancel pending MMD, preserve CNS access for active proposal/chat providers (#65, #31).

Responsibilities:
- Stop new batches/notifications.
- No lazy cron cleanup.

Implementation Details:
- Same txn as SR cancel.
- `matching_cancel_pending_mmd_for_service_request`.

Deliverables:
- Patch + pgTAP

Dependencies:
- Tasks 8, 16

Runtime Guarantees:
- Terminal CANCELLED immutable

Failure Handling:
- Rollback on failure

Observability:
- Cancel event audit

Security Considerations:
- Client auth unchanged

Performance Considerations:
- N/A

Requirements covered:
5

Acceptance Criteria covered:
5.20

---

### 30. [x] Migration M14e — Patch `expire_pending_proposals` for inline gate eval

Description:
After transitioning proposals to EXPIRED, invoke `evaluate_service_request_dispatch_gates(service_request_id)` **once per distinct affected SR** in same job txn (#105, #81).

Responsibilities:
- Immediate resume from STOPPED when slot frees — not wait 2 min cron.
- SHALL NOT open batches inline (#107).

Implementation Details:
- Collect DISTINCT `service_request_id` from expired set.
- Loop gate eval per SR.
- Integrate with existing `job_runs` wrapper.

Deliverables:
- Patch migration
- pgTAP: 4 proposals → expire one → gate resumes if below cap

Dependencies:
- Task 8

Runtime Guarantees:
- Per-SR gate eval exactly once per job run per SR

Failure Handling:
- job_run error if gate fails — alert ops

Observability:
- Log affected SR count per expire run

Security Considerations:
- Job runs as postgres

Performance Considerations:
- Bounded by expired proposal count per run

Requirements covered:
5

Acceptance Criteria covered:
5.17, 5.32, 5.33

---

### 31. [x] Verify `initiate_conversation` has NO `DISPATCH_STOPPED` gate

Description:
Code review + pgTAP: `initiate_conversation` SHALL NOT check dispatch STOPPED — only CNS slot rules (#88, #79). Document explicitly in migration comment if no code change needed.

Responsibilities:
- Chat admission independent of proposal cap.
- Discovery chat without proposal allowed when slot available.

Implementation Details:
- Negative test: 4 in-flight proposals + STOPPED + chat slot → chat OK.

Deliverables:
- pgTAP test
- Comment in M14 migration

Dependencies:
- Task 26 (STOPPED state reachable)

Runtime Guarantees:
- CNS slots sole chat gate

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
5, 13

Acceptance Criteria covered:
5.16 (chat dimension), 13.17

---

## Phase 11: Client — Device Beacon & Location

### 32. [x] Extend `deviceBeacon.api.ts` with location fields

Description:
Extend `src/features/device-beacon/api/deviceBeacon.api.ts` to upsert `location`, `location_accuracy_meters`, `location_recorded_at`, `location_permission_granted` alongside existing FCM fields.

Responsibilities:
- API layer only — no Supabase in components.
- Typed request/response.

Implementation Details:
- Use `extensions.geography` via WKT or lat/lng params per existing patterns.
- Return `{ beacon, error }` explicit object.

Deliverables:
- Updated `deviceBeacon.api.ts`
- Types in feature `types/`

Dependencies:
- Task 3 (schema deployed)

Runtime Guarantees:
- Upsert idempotent per (profile_id, device_id)

Failure Handling:
- Error surfaced to hook for retry

Observability:
- Logger on sync failure

Security Considerations:
- JWT auth only

Performance Considerations:
- Debounce at hook layer (Task 34)

Requirements covered:
12

Acceptance Criteria covered:
12.16–12.19

---

### 33. [x] Refactor location permission UX — `useLocationPermissionDialog` + explainer

Description:
Implement or **refactor** permission explainer before OS prompt for providers (#12.6–#12.10). May extend `useLocationPermissionDialog` and coordinate with existing `LocationPermissionBanner` (feed, Task 37) vs operational beacon permission (device-beacon, Task 34). Persist `orbit.location_prompt_seen` in Capacitor Preferences.

Responsibilities:
- Describe why location used (~20 km matching, periodic low-frequency).
- Decline → no OS prompt; `location_permission_granted = false` on next beacon sync.
- Confirm → trigger `@capgo/background-geolocation` / browser permission APIs.
- Clients (`role = client`) SHALL never see this flow (#12.1).

Implementation Details:
- Mobile-first UX per workspace `platform-ux` rule.
- PT-BR user strings.
- Task 67 wires dialog trigger for provider app bootstrap.

Deliverables:
- `hooks/useLocationPermissionDialog.ts` (new under `device-beacon/`)
- Dialog component if not covered by existing banner

Dependencies:
- Task 32

Runtime Guarantees:
- Clients never see permission flow (#12.2)

Failure Handling:
- Graceful degrade to neighborhood-only matching

Observability:
- Analytics event `location_permission_granted` / `location_permission_denied`

Security Considerations:
- Provider role gate

Performance Considerations:
- Show explainer once per device install (`LOCATION_PERMISSION_DIALOG_KEY`)

Requirements covered:
12

Acceptance Criteria covered:
12.6–12.10

---

### 34. [x] Implement `useProviderLocationTracking` + install `@capgo/background-geolocation`

Description:
Add dependency `@capgo/background-geolocation` (`yarn add @capgo/background-geolocation`; `yarn cap:sync`). Implement `useProviderLocationTracking` gated `profile.role === 'provider'`. Start/stop background geo on native; browser foreground-only (#12.11–#12.14). Debounce `LOCATION_SYNC_DEBOUNCE_MS = 30000` (#12.13). Distinct from feed `useProviderLocation` (Task 37).

Responsibilities:
- `distanceFilter` ~100m — low frequency.
- Stop on logout (`useAuth` cleanup) — integrate with existing `unregisterDeviceBeaconOnLogout`.
- Detect permission revocation → stop tracking (#12.10).
- SHOULD pause when `operational_status = suspended` (#12.15).
- Android: persistent notification `backgroundMessage`/`backgroundTitle` (#12.23).

Implementation Details:
- `utils/locationSync.ts` — prefer `@capacitor/http` on Android background (#12.24).
- `capacitor.config.ts`: `android.useLegacyBridge: true` (#12.23).
- iOS: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes` → `location` (#12.25).
- Mount via Task 67 — not only export hook.

Deliverables:
- `package.json` + `yarn.lock` dependency
- `hooks/useProviderLocationTracking.ts`
- `utils/locationSync.ts`
- Capacitor + iOS/Android native config updates

Dependencies:
- Tasks 32, 33, 66

Runtime Guarantees:
- No tracking for clients (#12.1–#12.3)
- No fabricated coordinates (#12.17)

Failure Handling:
- Offline queue retry on reconnect

Observability:
- Logger warn on sync failures

Security Considerations:
- Provider-only gating at hook mount

Performance Considerations:
- 30s debounce minimum between upserts

Requirements covered:
12

Acceptance Criteria covered:
12.1–12.3, 12.11–12.15, 12.23–12.25

---

## Phase 12: Client — Provider Jobs Feed

### 35. [x] Refactor `providerJobs.api.ts` — `list-provider-opportunities` Edge (cursor contract)

Description:
**Refactor** existing `src/features/provider-jobs/api/providerJobs.api.ts` (today calls `match-provider-jobs` with offset + `radius_km` + `service_id`) to invoke Edge `list-provider-opportunities` with cursor contract per design §5.2. **Remove** `page`, `page_size`, `radius_km`, `service_id` from request — progressive feed is visibility-gated; lat/lng affect sort only (#48, Req 13.3).

Responsibilities:
- API layer in `provider-jobs/api/`.
- Replace offset pagination with `cursor` + `limit`.
- Parse `{ items, next_cursor, has_more }` — **no** `total_count` in response.
- Remove dependency on `supabase/functions/match-provider-jobs/types`.

Implementation Details:
- `FEED_DEFAULT_LIMIT = 20`, `FEED_MAX_LIMIT = 50`.
- Refactor `provider-jobs.types.ts` — drop legacy `MatchProviderJobsBody` re-export.
- Add shared Edge types in Task 71.

Deliverables:
- `api/providerJobs.api.ts` (refactored)
- `types/provider-jobs.types.ts` (refactored)
- `api/__tests__/providerJobs.api.test.ts` (updated)

Dependencies:
- Task 24 (Edge deployed)

Runtime Guarantees:
- Cursor stable per sort mode

Failure Handling:
- Map 400 invalid cursor to client refresh (reset query)

Observability:
- Sentry feature=provider-jobs; span attributes: `sort_mode`, `has_cursor`

Security Considerations:
- Session JWT via supabase client

Performance Considerations:
- TanStack Query cache `staleTime: 60s`

Requirements covered:
13

Acceptance Criteria covered:
13.2, 13.8, 13.10

---

### 36. [x] Implement `dismissOpportunity.api.ts` + dismiss on `JobCard` (feed only)

Description:
`dismiss_provider_opportunity` RPC via `provider-jobs/api/`. Dismiss action on **`JobCard`** / feed list only — NOT on `ServiceDetailPage` (#117, #118). Do **not** create parallel `OpportunityFeedCard` — extend existing `JobCard`.

Responsibilities:
- Optimistic UI remove from feed list.
- Invalidate TanStack Query on success.

Implementation Details:
- PT-BR label "Não tenho interesse".
- Idempotent — treat success on repeat.
- New `DismissOpportunityButton` component or inline action on `JobCard`.

Deliverables:
- `api/dismissOpportunity.api.ts`
- `components/DismissOpportunityButton.tsx` (or equivalent on `JobCard`)
- Wire into `JobCard.tsx` / `ProviderJobsPage` list

Dependencies:
- Task 21 (RPC)

Runtime Guarantees:
- Feed-only hide (#102)

Failure Handling:
- Toast on error; rollback optimistic update

Observability:
- Analytics dismiss event via `useAnalytics`

Security Considerations:
- Provider only

Performance Considerations:
- Single RPC per dismiss

Requirements covered:
8, 13

Acceptance Criteria covered:
8.4, 13.21

---

### 37. [x] Refactor `useProviderLocation` — feed navigation GPS only (ADR 0002)

Description:
**Refactor** existing `src/features/provider-jobs/hooks/useProviderLocation.ts` (do not add parallel `useProviderFeedLocation`). Foreground GPS for feed sort only. When denied: force/default sort `newest`; hide/disable `nearest` in UI (#13.4–#13.5). Reuse/refactor existing `LocationPermissionBanner` for non-blocking prompt (#87).

Responsibilities:
- Separate from beacon operational location (`device-beacon` feature).
- `isUsingDefault` / `permissionDenied` semantics preserved for `ProviderJobsPage`.
- Browser geolocation on feed screen; native may use Capacitor geolocation API (not background-geolocation — that is Task 34).

Implementation Details:
- Do NOT send lat/lng when permission denied.
- Coordinate with Task 69 for `JobsSortTabs` visibility rules.

Deliverables:
- `hooks/useProviderLocation.ts` (refactored)
- `components/LocationPermissionBanner.tsx` (updated copy/behavior if needed)
- `hooks/__tests__/useProviderLocation.test.ts` (updated)

Dependencies:
- Task 35

Runtime Guarantees:
- Feed GPS never affects batch eligibility

Failure Handling:
- Degrade to non-geographic sorts

Observability:
- N/A

Security Considerations:
- Optional coords — user consent

Performance Considerations:
- Request location once per feed session

Requirements covered:
13

Acceptance Criteria covered:
13.3–13.5

---

### 38. [x] Refactor `useProviderJobs` — cursor infinite query (remove offset)

Description:
**Refactor** existing `src/features/provider-jobs/hooks/useProviderJobs.ts` from offset `page`/`page_size` to cursor-based `useInfiniteQuery` per design §5.2. `initialPageParam: null` (or undefined cursor); `getNextPageParam` from `next_cursor` when `has_more`. **Remove** `totalCount` / `providerServices` / `providerAreaSummary` if not returned by new RPC — adjust `JobsHeader` accordingly.

Responsibilities:
- `queryKey` includes `sort_mode`, optional lat/lng, cursor params.
- Reset/invalidate query on sort change (invalidates prior cursor per Req 13 AC11).
- Keep `staleTime: 60_000` per design §9.4.
- Remove `radiusKm` and `serviceId` from hook params (Tasks 68–69).

Implementation Details:
- `getNextPageParam: (last) => last.has_more ? last.next_cursor : undefined`.
- Flatten `pages[].items` for list render.
- Update `constants/queryKeys.ts` if needed.

Deliverables:
- `hooks/useProviderJobs.ts` (refactored)
- `hooks/__tests__/useProviderJobs.test.ts` (refactored)
- `components/ProviderJobsPage.tsx` (wire new hook shape)

Dependencies:
- Tasks 35, 37, 68, 69

Runtime Guarantees:
- Sort change invalidates prior cursor

Failure Handling:
- TanStack 1 retry default

Observability:
- Sentry span `provider_jobs.fetch_list` — attribute `has_cursor`, not `page`

Security Considerations:
- N/A

Performance Considerations:
- `staleTime: 60s` per design §9.4

Requirements covered:
13

Acceptance Criteria covered:
13.8–13.10

---

## Phase 13: Client — View Services Audit

### 39. [x] Implement `opportunityView.api.ts` + `useRecordProviderOpportunityView`

Description:
`record_provider_opportunity_view` via `view-services/api/`. Hook on `ServiceDetailPage` and `ServiceDetailSheet` mount when `serviceRequestId` defined and `role=provider` — without awaiting `get_service` (#115–#116).

Responsibilities:
- Fire-and-forget with `recordedRef` guard per mount.
- Logger warn on failure — no user toast.

Implementation Details:
- Normative pattern per design §13.11 snippet.
- Deep links covered (#94).

Deliverables:
- `api/opportunityView.api.ts`
- `hooks/useRecordProviderOpportunityView.ts`
- Wire into `ServiceDetailPage.tsx`, `ServiceDetailSheet.tsx`

Dependencies:
- Task 20 (RPC)

Runtime Guarantees:
- At most one client attempt per mount; server idempotent

Failure Handling:
- Silent fail — no retry storm

Observability:
- Logger `record_provider_opportunity_view_failed`

Security Considerations:
- Provider only

Performance Considerations:
- Non-blocking parallel to get_service

Requirements covered:
11, 13

Acceptance Criteria covered:
11.1–11.3, 13.14–13.15

---

## Phase 14: Observability & Auditability

### 40. [x] pgTAP suite — dispatch gate ladder

Description:
Comprehensive pgTAP tests for `evaluate_service_request_dispatch_gates` covering STOPPED/PAUSED/FALLBACK/ACTIVE transitions, `next_batch_at` rules, terminal no-op, resume `now()` (#106).

Responsibilities:
- Matrix test all ladder branches.
- Regression guard for #82, #85–#86, #108–#109.

Deliverables:
- `supabase/tests/matching/dispatch_gates_test.sql`

Dependencies:
- Task 8

Runtime Guarantees:
- N/A (tests)

Failure Handling:
- CI fails on regression

Observability:
- CI signal

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
5, 10A

Acceptance Criteria covered:
5.14–5.18, 5.33–5.36

---

### 41. [x] pgTAP suite — cron worker phases

Description:
Tests for phase 1 lifecycle expiration, phase 2a batch open, phase 2b gate-only, SKIP LOCKED concurrency simulation, lease recovery.

Deliverables:
- `supabase/tests/matching/cron_process_dispatches_test.sql`

Dependencies:
- Task 13

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- CI

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
5, 10, 10B

Acceptance Criteria covered:
5.23, 5.30–5.31, 10B.3

---

### 42. [x] pgTAP suite — discovery, ranking, idempotency

Description:
Tests for discover exclusions, 20km, neighborhood path, tie-break, dismiss/view idempotency, visibility UNIQUE.

Deliverables:
- `supabase/tests/matching/discovery_ranking_test.sql`
- `supabase/tests/matching/feed_audit_test.sql`

Dependencies:
- Tasks 9, 10, 20, 21

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- CI

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
1, 3, 4, 4A, 7, 8, 10A

Acceptance Criteria covered:
1.6, 3.1–3.19, 4A.6, 7.8, 8.3–8.4, 10A.1–10A.3

---

### 43. [x] Deno tests — `list-provider-opportunities` Edge

Description:
Auth rejection, suspended provider empty response, query param clamping, RPC error mapping.

Deliverables:
- `supabase/functions/list-provider-opportunities/index.test.ts`

Dependencies:
- Task 24

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- CI

Security Considerations:
- Verify JWT required

Performance Considerations:
- N/A

Requirements covered:
13

Acceptance Criteria covered:
13.2, 13.7

---

### 44. [x] Vitest — client hooks unit tests

Description:
`useRecordProviderOpportunityView` fires once per serviceRequestId; `useProviderLocationTracking` does not start for client role.

Deliverables:
- `src/features/view-services/hooks/useRecordProviderOpportunityView.test.ts`
- `src/features/device-beacon/hooks/useProviderLocationTracking.test.ts`

Dependencies:
- Tasks 34, 39

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- CI

Security Considerations:
- N/A

Performance Considerations:
- happy-dom environment

Requirements covered:
11, 12

Acceptance Criteria covered:
11.1, 12.1

---

### 45. [x] Operational dashboards & alerts (document + implement)

Description:
Document recommended dashboards per design §10.3–§10.4. Implement minimum: `job_runs` error rate alert for `matching_process_service_request_dispatches`; stuck lease alert (`lease_expires_at < now() - 10min AND lease_owner IS NOT NULL`).

Responsibilities:
- Active dispatches by status gauge.
- Batch open latency.
- Pool exhaustion rate.
- MMD `matching.new_opportunity` delivery ratio.

Deliverables:
- Runbook section in `docs/matching-algorithm/operations.md` OR inline ops appendix
- SQL queries for alerts
- Sentry/monitoring wiring if applicable

Dependencies:
- Task 13 (cron live)

Runtime Guarantees:
- N/A

Failure Handling:
- Alert → manual ops inspect `dispatch_events` + `job_runs`

Observability:
- Primary deliverable of this task

Security Considerations:
- Ops queries use service_role

Performance Considerations:
- Alert queries indexed

Requirements covered:
8, 10

Acceptance Criteria covered:
8.7, 10.6

---

## Phase 15: Recovery & Reliability

### 46. [x] Stuck lease reconciliation SQL + runbook

Description:
Document and optionally schedule weekly query for dispatches with stale `lease_owner` not NULL and `lease_expires_at` > 10 min past due. Manual `matching_release_dispatch_lease` procedure.

Responsibilities:
- Recovery from worker crash mid-batch.
- Prevent indefinite dispatch starvation.

Implementation Details:
- Normally self-heals via TTL — this is belt-and-suspenders ops.

Deliverables:
- Runbook procedure
- Optional one-off repair RPC `matching_force_release_stale_leases()`

Dependencies:
- Task 11

Runtime Guarantees:
- Lease TTL auto-recovery ≤6 min worst case

Failure Handling:
- Manual ops intervention for pathological cases

Observability:
- Alert from Task 45

Security Considerations:
- Admin/service_role only

Performance Considerations:
- Rare operation

Requirements covered:
10A

Acceptance Criteria covered:
10A.8–10A.9

---

### 47. [x] Cron failure escalation — consecutive `job_runs` errors

Description:
SHOULD alert when >10 consecutive `job_runs` errors for matching cron on same SR metadata (#8.3). Implement via `job_runs` metadata JSON or external monitor.

Deliverables:
- Alert rule
- Ops playbook: inspect `dispatch_events`, re-run manual gate eval

Dependencies:
- Task 13

Runtime Guarantees:
- N/A

Failure Handling:
- Poison dispatch row investigation

Observability:
- Primary

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
8, 10

Acceptance Criteria covered:
8.7

---

### 48. [x] MMD delivery failure runbook — visibility without push

Description:
Document Req #12 option A: push quota exhausted → visibility granted; email if quota; feed discovery. Ops SHALL NOT manually re-enqueue batch notifications for same idempotency key.

Deliverables:
- Runbook section

Dependencies:
- Task 15

Runtime Guarantees:
- Idempotency key prevents duplicate push

Failure Handling:
- Provider uses feed/email

Observability:
- MMD terminal status monitoring

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
6

Acceptance Criteria covered:
6.4

---

## Phase 16: Security & Isolation

### 49. [x] RLS audit — matching tables deny direct access

Description:
pgTAP verify `authenticated` cannot INSERT/UPDATE/DELETE on dispatch tables, `provider_latest_locations`; SELECT denied except where explicitly allowed (`provider_rating_stats`, `service_ratings` scoped).

Deliverables:
- `supabase/tests/matching/rls_matching_test.sql`

Dependencies:
- Tasks 5, 7

Runtime Guarantees:
- RPC-only mutation paths

Failure Handling:
- CI blocks deploy

Observability:
- N/A

Security Considerations:
- Primary deliverable

Performance Considerations:
- N/A

Requirements covered:
4, 11

Acceptance Criteria covered:
4.10–4.13, 12.19

---

### 50. [x] REVOKE audit — dangerous functions not granted to `anon`

Description:
Verify `cron_process_service_request_dispatches`, `evaluate_service_request_dispatch_gates`, `matching_open_batch` not executable by `anon`/`authenticated` — pattern from existing `job_run_begin` tests.

Deliverables:
- Grants test in RLS suite

Dependencies:
- Tasks 8, 12, 13

Runtime Guarantees:
- N/A

Failure Handling:
- CI fail

Observability:
- N/A

Security Considerations:
- Primary

Performance Considerations:
- N/A

Requirements covered:
10

Acceptance Criteria covered:
10.5

---

### 51. [x] Edge rate limiting for feed (optional)

Description:
Implement optional 60 req/min/user on `list-provider-opportunities` — fail-open on rate limit DB error per infra constraints (#9.5).

Deliverables:
- Rate limit check in Edge function
- Test: 429 when exceeded

Dependencies:
- Task 24

Runtime Guarantees:
- Fail-open preserves availability

Failure Handling:
- DB error → allow request

Observability:
- Rate limit hit metric

Security Considerations:
- Abuse prevention

Performance Considerations:
- Lightweight counter

Requirements covered:
13

Acceptance Criteria covered:
13.1 (abuse adjacent)

---

## Phase 17: Performance & Optimization

### 52. [x] EXPLAIN baseline — `matching_discover_candidates`

Description:
Capture EXPLAIN (ANALYZE, BUFFERS) on seeded dataset representative of production provider count. Verify GIST/H3 usage; no seq scan on `provider_latest_locations`.

Deliverables:
- `docs/matching-algorithm/perf/discovery-baseline.md` with plans
- Index adjustments if needed (new migration)

Dependencies:
- Task 9

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- Baseline for regression

Security Considerations:
- N/A

Performance Considerations:
- Primary deliverable

Requirements covered:
3, 9, 10

Acceptance Criteria covered:
3.4, 9.3, 10.1

---

### 53. [x] EXPLAIN baseline — `list_provider_opportunities`

Description:
p95 target < 500ms (#1.5). Optimize proposal/chat exclusion semi-joins; verify `srv_visibility_feed_idx` usage.

Deliverables:
- Perf doc with plans
- Optional supporting indexes migration

Dependencies:
- Tasks 17–19

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- p95 alert > 800ms (#10.4)

Security Considerations:
- N/A

Performance Considerations:
- Primary

Requirements covered:
13

Acceptance Criteria covered:
13.1, 13.9

---

### 54. [x] Load test — concurrent cron workers

Description:
Simulate 2+ overlapping cron invocations processing due dispatches. Verify SKIP LOCKED + lease prevent double batch open. Tool: pgTAP with parallel sessions or scripted integration test.

Deliverables:
- `supabase/tests/matching/concurrency_cron_test.sql`

Dependencies:
- Task 13

Runtime Guarantees:
- No duplicate batch_providers for same batch_number

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- Primary

Requirements covered:
10, 10A

Acceptance Criteria covered:
10.3, 10.6, 10A.2, 10A.7

---

## Phase 18: Verification & E2E

### 55. [x] E2E — progressive feed visibility

Description:
Playwright: provider sees SR after batch open; not before; dismiss hides card; detail via link still works.

Deliverables:
- `e2e/matching/provider-feed.spec.ts`

Dependencies:
- Tasks 35, 36, 39; backend M10–M12 deployed

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- CI artifact screenshots

Security Considerations:
- Test provider auth

Performance Considerations:
- N/A

Requirements covered:
5, 8, 13

Acceptance Criteria covered:
5.4, 8.4, 13.20

---

### 56. [x] E2E — cursor pagination stability

Description:
Fetch page 1 and 2 with cursor; verify no duplicates; change sort invalidates cursor.

Deliverables:
- E2E test cases in same or separate spec

Dependencies:
- Task 38

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- CI

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
13

Acceptance Criteria covered:
13.8–13.11

---

### 57. [x] E2E — DISPATCH_STOPPED proposal block + chat allow

Description:
4 in-flight proposals → STOPPED → create_provider_proposal fails; initiate_conversation succeeds if slot available.

Deliverables:
- `e2e/matching/dispatch-stopped.spec.ts`

Dependencies:
- Tasks 26, 31

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- CI

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
5, 13

Acceptance Criteria covered:
5.16, 13.16–13.17, 13.19

---

### 58. [x] Integration test — full batch → MMD → push path (staging)

Description:
Staging checklist: OPEN SR → wait cron → batch_providers row → MMD ingest rows → worker delivery → provider feed shows opportunity.

Deliverables:
- Manual QA checklist
- Optional automated staging script

Dependencies:
- Tasks 13, 15, 24, 35

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- End-to-end trace

Security Considerations:
- Staging credentials

Performance Considerations:
- Cron wait ≤2 min per tick

Requirements covered:
1, 5, 6, 13

Acceptance Criteria covered:
5.1–5.4, 6.1, 6.6

---

## Phase 19: Rollout & Legacy Removal

### 59. [x] Feature flag `matching.enabled` rollout procedure

Description:
If seeded in M1: document toggle procedure. Enable after M12+M14 deployed and validated. Monitor `job_runs` and dispatch table growth.

Deliverables:
- Rollout checklist in operations doc
- SQL: `UPDATE platform_constants SET value = 'true' WHERE key = 'matching.enabled'`

Dependencies:
- Tasks 1, 13, 26–30

Runtime Guarantees:
- N/A

Failure Handling:
- Disable flag → client can stay on legacy until M15

Observability:
- Dispatch count metrics post-enable

Security Considerations:
- Admin SQL only

Performance Considerations:
- Gradual SR creation rate

Requirements covered:
All (rollout)

Acceptance Criteria covered:
N/A (operational)

---

### 60. [x] Client cutover — swap feed API behind flag

Description:
Wire `provider-jobs` to use new API when `matching.enabled` OR always after validation. Remove references to `match-provider-jobs` Edge in client code.

Deliverables:
- Feature flag check in hook or env
- Remove dead code paths

Dependencies:
- Tasks 35, 59

Runtime Guarantees:
- N/A

Failure Handling:
- Rollback to legacy Edge if flag false

Observability:
- Analytics feed_impression source

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
13

Acceptance Criteria covered:
13.2

---

### 61. [x] Migration M15 — Drop legacy `match_provider_jobs` + remove Edge

Description:
`DROP FUNCTION match_provider_jobs`; remove `supabase/functions/match-provider-jobs/`; update `supabase/config.toml`; regenerate types. Deploy **only after** client cutover validated (#59, #60).

Responsibilities:
- Irreversible removal of open feed.
- Keep `provider-jobs` routes and feature name (#49).

Implementation Details:
- Verify no remaining references via ripgrep CI check.

Deliverables:
- `*_matching_drop_legacy_feed.sql`
- Delete legacy Edge function
- CI grep guard

Dependencies:
- Task 60
- All feed E2E green

Runtime Guarantees:
- N/A

Failure Handling:
- Rollback requires git revert + redeploy — acceptable per decision #8

Observability:
- Deploy log

Security Considerations:
- Remove unused Edge attack surface

Performance Considerations:
- N/A

Requirements covered:
13

Acceptance Criteria covered:
13.2

---

### 63. [x] Regenerate Supabase types + update feature exports

Description:
Run `yarn generate-supabase-types` after all migrations. Update `provider-jobs/index.ts`, `view-services/index.ts`, `device-beacon/index.ts` Public API exports.

Deliverables:
- `src/lib/supabase/database.types.ts`
- Feature `index.ts` files

Dependencies:
- Migrations applied locally

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
N/A (engineering hygiene)

Acceptance Criteria covered:
N/A

---

## Phase 20: Discovery Geo Helpers & RPC Grants

### 64. [x] `matching_h3_ring_cells` + `matching_compute_explored_h3_cells` helpers

Description:
Implement internal SQL helpers supporting discovery pre-filter and batch audit per design §9.1 and Req 2 AC5. `matching_h3_ring_cells(p_center_h3 bigint, p_resolution int)` returns H3 cell set (k-ring expansion until reasonable cardinality). `matching_compute_explored_h3_cells(p_sr_id uuid)` returns jsonb array persisted to `service_request_dispatch_batches.explored_h3_cells` — **audit only**, SHALL NOT affect future eligibility.

Responsibilities:
- H3 coarse reduction before GIST `ST_DWithin` in `matching_discover_candidates` (Task 9).
- Populate `explored_h3_cells` in `matching_open_batch` (Task 12).
- Use `matching.h3_resolution` from `platform_constants` (default 7).

Implementation Details:
- `SET search_path = public, extensions`.
- Requires PostGIS/H3 extension already in project.
- If H3 extension unavailable in local dev, document fallback to GIST-only with CI assertion on staging.

Deliverables:
- Functions in `*_matching_discovery_ranking.sql` (same migration as Task 9 or follow-up)
- pgTAP: explored cells non-empty for SR with beacon providers in range

Dependencies:
- Task 1 (h3_resolution constant)
- Task 4 (`provider_latest_locations.h3_index`)

Runtime Guarantees:
- Deterministic cell set for same SR location

Failure Handling:
- Empty ring → discovery falls back to GIST-only path

Observability:
- `explored_h3_cells` length in batch audit

Security Considerations:
- Internal only — no client GRANT

Performance Considerations:
- Cap k-ring expansion to avoid huge cell lists in dense metros

Requirements covered:
2, 9

Acceptance Criteria covered:
2.5, 3.4, 3.8, 3.10, 9.2

---

### 65. [x] GRANT EXECUTE on client-facing matching RPCs

Description:
Explicit migration step (may ship in M12/M13 migrations) granting `EXECUTE` on public RPCs called directly by authenticated clients. Edge-proxied `list_provider_opportunities` remains `service_role` only at DB level.

Responsibilities:
- `GRANT EXECUTE ON FUNCTION dismiss_provider_opportunity(uuid) TO authenticated`.
- `GRANT EXECUTE ON FUNCTION record_provider_opportunity_view(uuid) TO authenticated`.
- `GRANT EXECUTE ON FUNCTION submit_service_rating(...) TO authenticated`.
- `GRANT EXECUTE ON FUNCTION update_service_rating(...) TO authenticated`.
- **REVOKE** from `anon` where applicable.
- Verify `cron_process_service_request_dispatches`, `matching_open_batch`, `evaluate_service_request_dispatch_gates` are **not** granted to `authenticated`/`anon` (Task 50).

Implementation Details:
- Mirror existing CNS RPC grant patterns.
- `SECURITY DEFINER` + `SET search_path = public` on each RPC.

Deliverables:
- GRANT/REVOKE statements in M12/M13 or dedicated `*_matching_rpc_grants.sql`
- pgTAP grant tests (extends Task 50)

Dependencies:
- Tasks 20, 21, 22, 23

Runtime Guarantees:
- Least-privilege EXECUTE surface

Failure Handling:
- Migration failure blocks client RPC access

Observability:
- N/A

Security Considerations:
- Primary deliverable — authenticated-only writes

Performance Considerations:
- N/A

Requirements covered:
4, 8, 11, 13

Acceptance Criteria covered:
4.12, 11.1–11.2, 13.21

---

## Phase 21: Device Beacon — Operational Location Pipeline

### 66. [x] Extend `collectDeviceBeaconPayload` + `DeviceBeaconProvider` for location fields

Description:
Extend existing `device-beacon` pipeline (today FCM-only) to include operational location fields per Req 12 AC16–18. Update `collectDeviceBeaconPayload.ts`, `deviceBeacon.types.ts`, and `DeviceBeaconProvider.tsx` sync paths to pass `location`, `location_accuracy_meters`, `location_recorded_at`, `location_permission_granted` to `upsertDeviceBeacon` (Task 32).

Responsibilities:
- Integrate samples from `useProviderLocationTracking` (Task 34) into payload builder.
- Preserve existing push sync behavior for all roles; location fields only when provider + permission granted.
- `shouldSyncDeviceBeacon` MUST consider location field changes for provider rows.

Implementation Details:
- WKT/geography encoding consistent with API layer.
- No fabricated coordinates when permission false (#12.17).
- Role gate: skip location population for `client` (#12.2–#12.3).

Deliverables:
- `utils/collectDeviceBeaconPayload.ts` (extended)
- `types/deviceBeacon.types.ts` (extended)
- `components/DeviceBeaconProvider.tsx` (coordinate with location hook)
- `utils/__tests__/collectDeviceBeaconPayload.test.ts` (updated)

Dependencies:
- Tasks 3, 32, 34

Runtime Guarantees:
- Upsert idempotent per `(profile_id, device_id)`

Failure Handling:
- Logger warn; retry on next debounce window

Observability:
- `device_beacon_synced` log includes `has_location: boolean`

Security Considerations:
- `auth.uid() = profile_id` via API/RLS

Performance Considerations:
- Respect `LOCATION_SYNC_DEBOUNCE_MS`

Requirements covered:
12

Acceptance Criteria covered:
12.3, 12.16–12.18

---

### 67. [x] Mount provider location tracking in app shell

Description:
Wire `useProviderLocationTracking` + `useLocationPermissionDialog` into provider session lifecycle — e.g. `DeviceBeaconProvider`, authenticated provider layout, or `main.tsx` provider-only branch. SHALL start after auth resolves `role === 'provider'`; SHALL stop on logout (Task 34, Req 12 AC14).

Responsibilities:
- Single mount point — avoid duplicate background-geolocation instances.
- Clients and admins never initialize tracking (#12.1).
- Native: show permission dialog once per install before OS prompt (Task 33).

Implementation Details:
- Do not mount in `ProviderJobsPage` alone — batch eligibility requires background sync while app backgrounded.
- Coordinate with existing `DeviceBeaconProvider` push sync — same feature folder public API.

Deliverables:
- Integration in `DeviceBeaconProvider.tsx` or dedicated `ProviderLocationProvider.tsx` exported from `device-beacon/index.ts`
- Vitest: provider role mounts hook; client role does not

Dependencies:
- Tasks 33, 34, 66

Runtime Guarantees:
- At most one background-geolocation watcher per provider session

Failure Handling:
- Permission denied → neighborhood eligibility path only

Observability:
- Logger `provider_location_tracking_started` / `_stopped`

Security Considerations:
- Provider role gate at mount

Performance Considerations:
- Lazy start after first provider dashboard load acceptable

Requirements covered:
12

Acceptance Criteria covered:
12.1, 12.6–12.8, 12.14

---

## Phase 22: Client — Provider Jobs Feed Cutover (legacy removal)

### 68. [x] Remove open-feed filters — `JobsFiltersBar` radius + service_id

Description:
Remove **open-radius feed** UX from `provider-jobs`: delete or gut `radius_km` filter (`RADIUS_OPTIONS`, `DEFAULT_RADIUS_KM` usage in feed query), remove `service_id` server filter from feed path. Progressive feed lists only visibility-gated opportunities — no client-side radius filtering (#48, Req 13.3). Refactor `useProviderJobsFilters.ts` accordingly.

Responsibilities:
- Remove `setRadiusKm`, `setServiceId` from feed data path (may keep local UI filters only if product insists — **SHALL NOT** send to `list_provider_opportunities`).
- Update `JobsHeader` — remove `totalCount` if RPC no longer returns it; use `items.length` + `has_more` or "X oportunidades" without total.
- Remove `providerServices` / `providerAreaSummary` from hook if not in new RPC response.

Implementation Details:
- `constants/sortModes.ts`: remove or deprecate `RADIUS_OPTIONS`, `DEFAULT_RADIUS_KM` from feed path.
- `components/JobsFiltersBar.tsx`: remove radius/service controls OR repurpose as client-only cosmetic filters (document if kept).
- `components/ProviderJobsPage.tsx`: update `hasActiveFilters` logic.

Deliverables:
- Refactored `JobsFiltersBar.tsx`, `useProviderJobsFilters.ts`, `JobsHeader.tsx`, `ProviderJobsPage.tsx`
- Updated component tests: `JobsFiltersBar.test.tsx`, `ProviderJobsPage.test.tsx`

Dependencies:
- Task 35

Runtime Guarantees:
- Feed API receives only `sort_mode`, `cursor`, `limit`, optional `lat`/`lng`

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- Simpler queryKey — fewer refetch dimensions

Requirements covered:
13

Acceptance Criteria covered:
13.1, 13.3, 13.4

---

### 69. [x] Refactor `JobsSortTabs` + `sortModes.ts` — GPS-gated `nearest`

Description:
Update sort UI so **`nearest`** is hidden/disabled when feed GPS unavailable; default **`newest`** without GPS, **`nearest`** when GPS available (#73, Req 13.4–5). Refactor `SORT_MODES` / `DEFAULT_SORT_MODE` in `constants/sortModes.ts` (today defaults `nearest` unconditionally — **incorrect** for new contract).

Responsibilities:
- `JobsSortTabs` receives `hasFeedGps: boolean` from `useProviderLocation`.
- Auto-switch sort to `newest` when GPS lost mid-session.
- Preserve `least_competitive` in both modes.

Implementation Details:
- `components/JobsSortTabs.tsx` + `constants/__tests__/sortModes.test.ts`.
- Mobile-first tab layout unchanged.

Deliverables:
- Updated `sortModes.ts`, `JobsSortTabs.tsx`, tests

Dependencies:
- Task 37

Runtime Guarantees:
- Invalid sort+GPS combo never sent to API

Failure Handling:
- GPS timeout → fall back to `newest`

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
13

Acceptance Criteria covered:
13.3–13.5

---

### 70. [x] Update provider-jobs test suite for progressive feed contract

Description:
Systematically update all existing `provider-jobs` tests that assume open-feed contract (`match-provider-jobs`, offset pages, `total_count`, radius, `service_id`). Files include at minimum: `providerJobs.api.test.ts`, `useProviderJobs.test.ts`, `useProviderJobsFilters.test.ts`, `useProviderLocation.test.ts`, `ProviderJobsPage.test.tsx`, `JobCard.test.tsx`, `JobsSortTabs.extra.test.tsx`, `publicApi.test.ts`.

Responsibilities:
- Mock Edge `list-provider-opportunities` response shape `{ items, next_cursor, has_more }`.
- Remove assertions on `match-provider-jobs` invoke.
- Add dismiss button test on `JobCard` (Task 36).
- Run `yarn test:run` green for `src/features/provider-jobs/`.

Implementation Details:
- Follow `unit-tests` workspace rule — update tests when production code changes.
- Fixtures in `__tests__/fixtures/jobFixtures.ts` aligned with new item shape (`source`, `granted_at`, `distance_km`, etc.).

Deliverables:
- All updated `provider-jobs/**/__tests__/**`
- CI green

Dependencies:
- Tasks 35, 36, 37, 38, 68, 69

Runtime Guarantees:
- N/A (tests)

Failure Handling:
- N/A

Observability:
- CI signal

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
13

Acceptance Criteria covered:
13.2, 13.8–13.11, 13.21

---

### 71. [x] Edge shared types — `list-provider-opportunities/types.ts`

Description:
Create `supabase/functions/list-provider-opportunities/types.ts` mirroring pattern from `match-provider-jobs/types.ts`. Export request/response types for Edge handler and optional client import. Replace `provider-jobs` re-export from legacy Edge types.

Responsibilities:
- Request: `sort_mode`, `cursor?`, `limit?`, `lat?`, `lng?`.
- Response: `{ items, next_cursor, has_more }` with item fields per design §5.2.
- Keep Edge and client types in sync (client may duplicate subset in feature types).

Implementation Details:
- Deno-compatible types (no Node-only imports).
- Used by `index.test.ts` (Task 43).

Deliverables:
- `supabase/functions/list-provider-opportunities/types.ts`
- Update `provider-jobs/types/provider-jobs.types.ts` to import or mirror

Dependencies:
- Task 24

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
13

Acceptance Criteria covered:
13.2, 13.10

---

## Phase 23: Extended Verification

### 72. [x] pgTAP suite — CNS M14 dispatch integration

Description:
Dedicated pgTAP file exercising patched CNS RPCs: `create_provider_proposal` STOPPED reject, `accept_proposal` → `DISPATCH_MATCHED` + visibility revoke + MMD cancel, `cancel_service_request` → `DISPATCH_CANCELLED`, `expire_pending_proposals` inline gate per SR, `initiate_conversation` allowed under STOPPED when slot available.

Responsibilities:
- End-to-end SQL tests with fixture SR, dispatch, proposals, chats.
- Assert gate ladder side effects without waiting for cron.

Implementation Details:
- `supabase/tests/matching/cns_dispatch_integration_test.sql`
- Use savepoints or isolated fixtures per test case.

Deliverables:
- pgTAP file + CI inclusion in `yarn test:deno` / pgTAP runner

Dependencies:
- Tasks 26–31, 16

Runtime Guarantees:
- N/A

Failure Handling:
- CI blocks merge on failure

Observability:
- N/A

Security Considerations:
- Tests run as superuser/postgres

Performance Considerations:
- N/A

Requirements covered:
5, 13

Acceptance Criteria covered:
5.16–5.20, 5.32, 13.16–13.19

---

### 73. [x] pgTAP suite — rating RPCs (`submit` / `update`)

Description:
Dedicated pgTAP beyond inline deliverables of Tasks 22–23: duplicate submit reject, 48h edit boundary, wrong client reject, `overall_score` weight verification, stats trigger side effects on `provider_rating_stats`.

Deliverables:
- `supabase/tests/matching/rating_rpcs_test.sql`

Dependencies:
- Tasks 7, 22, 23

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- RLS deny direct insert verified

Performance Considerations:
- N/A

Requirements covered:
4

Acceptance Criteria covered:
4.12, 4.14–4.15

---

### 74. [x] Regression test — `get_service` has no dispatch audit side effects

Description:
pgTAP or Vitest integration asserting `get_service` invocation does **not** insert into `service_request_dispatch_events` (Req 11.3, #92). Complements Task 20 (`record_provider_opportunity_view` is separate client path).

Responsibilities:
- Call `get_service` as provider; count `provider_viewed` events before/after — must be unchanged.
- Document as guard against future accidental side effects.

Deliverables:
- `supabase/tests/matching/get_service_no_dispatch_side_effects_test.sql`

Dependencies:
- Task 5 (dispatch_events table)
- Existing `get_service` RPC

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
11, 13

Acceptance Criteria covered:
11.3, 13.14

---

### 75. [x] Failure injection tests — lease recovery + cron concurrency

Description:
Extend Task 54 with explicit failure scenarios from design §8.1: simulated worker crash (lease not released), expired lease re-acquire, concurrent `cron_process_service_request_dispatches` invocations, discovery `statement_timeout` → `job_run_abort` path.

Responsibilities:
- Assert no duplicate `batch_number` for same dispatch.
- Assert txn rollback leaves no orphan visibility without batch row.

Implementation Details:
- `supabase/tests/matching/failure_injection_test.sql`
- May use `pg_sleep` + forced lease expiry for timing tests.

Deliverables:
- pgTAP failure injection suite

Dependencies:
- Tasks 11, 12, 13, 54

Runtime Guarantees:
- N/A

Failure Handling:
- Primary validation target

Observability:
- `job_runs` error rows asserted

Security Considerations:
- N/A

Performance Considerations:
- Mark slow tests if needed

Requirements covered:
10, 10A

Acceptance Criteria covered:
10.6–10.7, 10A.2, 10A.9–10A.10

---

### 76. [x] E2E — fallback marketplace, `DISPATCH_EXPIRED`, dispatch gates

Description:
Playwright scenarios beyond Tasks 55–57: (1) pool exhaustion → fallback-eligible provider sees lazy opportunity; (2) post-`DISPATCH_EXPIRED` batch visibility persists, lazy fallback hidden; (3) `DISPATCH_PAUSED` stops new batches; (4) `DISPATCH_STOPPED` blocks proposal but allows chat with slot.

Responsibilities:
- Seed or API-setup dispatches in target states (test helpers).
- Validate feed visibility matches Req 5 AC21–27.

Deliverables:
- `e2e/matching/dispatch-lifecycle.spec.ts`

Dependencies:
- Tasks 17–19, 26–31, 35, 38

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- CI artifacts

Security Considerations:
- Test provider auth

Performance Considerations:
- Account for ~2 min cron cadence in waits or use DB time manipulation in test setup

Requirements covered:
5, 13

Acceptance Criteria covered:
5.14–5.17, 5.21–5.27, 13.1, 13.6

---

### 77. [x] Staging validation — provider geo → beacon → batch discovery path

Description:
Manual or semi-automated staging checklist: provider grants location → `user_device_beacons` row updated → `provider_latest_locations` trigger fires → OPEN SR → cron opens batch → provider in batch receives visibility + MMD row. Complements Task 58.

Responsibilities:
- Validate `@capgo/background-geolocation` on Android device (notification, background sync).
- Validate web/PWA foreground-only limitation documented to QA.

Deliverables:
- `docs/matching-algorithm/qa/staging-geo-batch-checklist.md`

Dependencies:
- Tasks 34, 66, 67, 13, 15

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- End-to-end trace checklist

Security Considerations:
- Staging credentials only

Performance Considerations:
- N/A

Requirements covered:
1, 6, 12

Acceptance Criteria covered:
12.5, 12.20–12.22, 6.1

---

### 78. [x] Sync `docs/business/` after matching rollout

Description:
Per workspace rule `business-docs-sync-after-code-changes`: after implementation PRs touch `src/` or `supabase/`, update business documentation — `docs/business/modulos/` (provider-jobs, dispatch, ratings), `rastreabilidade.md`, `matriz-cobertura-documental.md`, glossário as needed.

Responsibilities:
- Document progressive matching replacing open feed.
- Document dual location model (batch beacon vs feed GPS).
- Document dispatch gates (`STOPPED`/`PAUSED`/fallback) in business language.

Implementation Details:
- Run after Task 60 (client cutover) or incrementally per merged PR.
- Portuguese (Brasil) per project convention.

Deliverables:
- Updated `docs/business/**` files
- Clear `.cursor/hooks/.business-docs-sync-pending.json` if present

Dependencies:
- Tasks 60–61 (minimum)

Runtime Guarantees:
- N/A

Failure Handling:
- N/A

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
All (product documentation)

Acceptance Criteria covered:
N/A (process)

---

### 79. [x] Conditional — advisory lock in `matching_open_batch` if load test fails

**Status: Skipped** — Tasks 54 (`concurrency_cron_test.sql`) and 75 (`failure_injection_test.sql`) pass with no duplicate `batch_number` under back-to-back / concurrent cron ticks. Lease CAS + `SKIP LOCKED` sufficient; advisory lock not added per design §7.4 escape hatch.

Description:
**Only if** Task 54 or 75 detects duplicate batch open under concurrent cron: add `pg_advisory_xact_lock(hashtext(p_service_request_id::text))` inside `matching_open_batch` per design §7.4. Skip if lease + SKIP LOCKED already sufficient.

Responsibilities:
- Belt-and-suspenders against lease bug.
- Document in migration comment why added.

Deliverables:
- Follow-up migration `*_matching_open_batch_advisory_lock.sql` OR amend before first prod deploy
- pgTAP concurrent test passes

Dependencies:
- Tasks 54, 75

Runtime Guarantees:
- Exactly one batch open per SR per tick

Failure Handling:
- Second worker blocks until txn completes or skips

Observability:
- Log when advisory lock wait > 1s

Security Considerations:
- N/A

Performance Considerations:
- Minimal contention expected — per-SR lock

Requirements covered:
10A

Acceptance Criteria covered:
10A.2, 10A.7

---

### 80. [x] Post-rollout validation — 200 AC traceability audit

Description:
Engineering sign-off: trace each of 200 acceptance criteria to deployed artifact (migration, RPC, test). Update design §12 mapping if gaps found. **Runs last** — after client cutover, verification suites, and business docs sync.

Deliverables:
- Completed traceability matrix spreadsheet or markdown appendix
- Sign-off checklist

Dependencies:
- All prior tasks (minimum: backend 1–31, client 32–38, 66–71, verification 40–44, 72–76, rollout 78)

Runtime Guarantees:
- N/A

Failure Handling:
- Gap → new task before GA

Observability:
- N/A

Security Considerations:
- N/A

Performance Considerations:
- N/A

Requirements covered:
1–13, 4A, 10A, 10B

Acceptance Criteria covered:
All 200

---

## Parallelization Guide

| Can parallelize after | Stream |
|-----------------------|--------|
| Task 5 | Tasks 7, 8 — ratings vs gates |
| Task 4 | Tasks 9, 10, 64 — discovery |
| Task 3 | Tasks 32–33, 66 — client beacon API + payload (parallel to backend) |
| Task 24 | Tasks 35–38, 68–71 — client feed cutover parallel to M14 |
| Tasks 20–23 | Task 65 — RPC grants |
| Tasks 26–31 | Task 72 — CNS pgTAP |
| Tasks 13, 15 | Task 58, 77 — staging batch path |

**Critical path:** 1 → 5 → 6 → 8 → 9 → 64 → 10 → 11 → 12 → 13 → 14–15 → 17–21 → 65 → 24 → 71 → 35 → 68–70 → 26–30 → 66–67 → 34 → 60 → 61 → 63 → 72–76 → 78 → **80**

**Total tasks:** 80 (63 original + 16 gap-fill tasks 64–79 + post-rollout audit 80)

---

## Requirement → Phase Index

| Req | Primary tasks |
|-----|---------------|
| 1 Dynamic discovery | 6, 9, 64, 12, 13 |
| 2 State persistence | 5, 6, 12, 64 |
| 3 Eligibility | 2, 4, 9, 64 |
| 4 Ratings/ranking | 7, 10, 22–23, 73 |
| 4A Score formalization | 10 |
| 5 Progressive batch | 6, 8, 12, 13, 26–30, 76 |
| 6 Notifications | 14–16, 25, 58, 77 |
| 7 Load balancing | 10 |
| 8 Auditability | 5, 12, 13, 20–21, 45 |
| 9 Geo indexing | 4, 9, 64 |
| 10 Scalability | 11–13, 52–54, 75 |
| 10A Idempotency | 5, 11–12, 15, 54, 75, 79 |
| 10B Scheduling | 6, 11–13 |
| 11 Response tracking | 20, 39, 74 |
| 12 Geolocation client | 3–4, 32–34, 66–67, 77 |
| 13 Feed | 17–19, 24, 35–38, 68–71, 61 |

## Gap-fill changelog (2026-06-17)

Tasks **64–79** added after coverage audit: H3/explored cells, RPC GRANTs, device-beacon pipeline integration, provider-jobs legacy cutover (radius/service filters, sort defaults, test suite), extended pgTAP/E2E, business docs sync, conditional advisory lock. Task **80** (post-rollout 200 AC traceability audit) moved to end of numeric order so the loop does not block on sign-off before tasks 63–79. Tasks **1–63** updated: fixed Task 12 MMD dependency (15 not 35), critical path table, client tasks refactored to match existing codebase (`useProviderJobs`, `JobCard`, `useProviderLocation`).

---

**End of implementation tasks document.**
