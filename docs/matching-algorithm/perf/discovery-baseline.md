# Discovery baseline — `matching_discover_candidates`

Captured for **matching task 52** (Req 3.4, 9.3, 10.1). Serves as regression reference for batch-open discovery performance.

## Environment

| Item | Value |
|------|--------|
| Date | 2026-06-18 |
| Database | Supabase local (`supabase_db_*`) |
| Seed SR | `7017e457-5a32-44e7-b8da-1727a14f4d33` (OPEN, São Paulo area) |
| Active providers | 2 (seed) |
| `provider_latest_locations` rows | 2 (upserted via script) |
| Discovery radius | 20 km (`ST_DWithin`) |
| Pool cap | 200 (`p_limit`) |
| H3 resolution | `matching.h3_resolution` (default 7) |

> **Note:** Local seed has a small provider count. Plan *shape* (GIST + H3 pre-filter) is what we lock for CI/regression; re-run on staging with production-scale counts before major index changes.

## How to reproduce

```bash
# Requires local Supabase running (yarn db:reset or supabase start)
docker exec -i supabase_db_<container_id> psql -U postgres -d postgres -f - \
  < supabase/scripts/matching-discovery-explain-beacon-path.sql
```

Scripts:

- `supabase/scripts/matching-discovery-explain-beacon-path.sql` — beacon-path CTE + function-level EXPLAIN
- `supabase/scripts/matching-discovery-explain-baseline.sql` — optional bulk seed (dev only; may conflict with `handle_new_user` trigger)

## Indexes under test

| Table | Index | Purpose |
|-------|--------|---------|
| `provider_latest_locations` | `provider_latest_locations_location_gist` (GIST) | `ST_DWithin` / KNN distance |
| `provider_latest_locations` | `provider_latest_locations_h3_idx` | H3 cell pre-filter |
| `service_requests` | PK + location columns | SR anchor |
| `provider_offered_services` | PK `(provider_id, service_id)` | Service eligibility |

**Index adjustment:** None required — GIST and H3 indexes from M4/M9 are used as intended.

## Acceptance checklist

| Criterion | Result |
|-----------|--------|
| No sequential scan on `provider_latest_locations` | **Pass** — `Index Scan using provider_latest_locations_location_gist` |
| GIST used for geo filter | **Pass** — `Index Cond: location && _st_expand(..., 20000)` + `st_dwithin` filter |
| H3 pre-filter present | **Pass** — `matching_h3_ring_cells` + `h3_index IN (...)` hashed subplan |
| End-to-end RPC completes | **Pass** — ~5 ms on seed (2 candidates returned) |

---

## Plan A — Beacon path (core `provider_latest_locations` query)

Extracted from `matching_discover_candidates` beacon CTE (same joins/filters as production).

```
 Limit  (cost=110.98..110.99 rows=1 width=56) (actual time=0.078..0.080 rows=0 loops=1)
   Buffers: shared hit=11
   CTE sr
     ->  Index Scan using service_requests_pkey on service_requests sr_1
           Index Cond: (id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid)
   CTE h3_cells
     ->  Nested Loop
           ->  CTE Scan on sr
           ->  Function Scan on matching_h3_ring_cells cell
   ->  Sort  (cost=82.25..82.26 rows=1 width=56)
         Sort Key: (st_distance(pll.location, sr.location, true)), pll.provider_id
         ->  Nested Loop
               ->  Nested Loop
                     ->  CTE Scan on sr  (Filter: location IS NOT NULL)
                     ->  Index Scan using provider_latest_locations_location_gist on provider_latest_locations pll
                           Index Cond: ((location && _st_expand(sr.location, '20000'::double precision))
                                        AND (location IS NOT NULL))
                           Filter: (h3_index IN (hashed SubPlan h3_cells)
                                    AND location_recorded_at >= now() - interval '24 hours'
                                    AND st_dwithin(location, sr.location, 20000))
                     ->  Index Scan using profiles_pkey on profiles p
                           Filter: (operational_status = 'active')
               ->  Index Only Scan using provider_offered_services_pkey on provider_offered_services pos
 Planning Time: 1.352 ms
 Execution Time: 0.257 ms
```

**Observations**

- **GIST index scan** drives the geo predicate; no `Seq Scan on provider_latest_locations`.
- H3 ring cells computed via `matching_h3_ring_cells` (k=0..3); when SR has no H3 index, `NOT EXISTS (h3_cells)` bypasses H3 filter (see function source).
- `ST_DWithin` applied as index filter + recheck (`st_dwithin` in Filter).

---

## Plan B — Full RPC (`matching_discover_candidates`)

```
 Function Scan on matching_discover_candidates
   (cost=0.25..10.25 rows=1000 width=81)
   (actual time=5.299..5.300 rows=2 loops=1)
   Buffers: shared hit=1074
 Execution Time: 5.311 ms
```

PL/pgSQL functions appear as a single `Function Scan` in EXPLAIN; use **Plan A** to inspect `provider_latest_locations` access. Full RPC time includes load-cap CTE, neighborhood union, and exclusion semi-joins.

---

## Regression guidance

1. Re-run Plan A after changes to `matching_discover_candidates`, `provider_latest_locations` schema, or geo/H3 indexes.
2. Fail the review if Plan A shows `Seq Scan on provider_latest_locations` at scale.
3. Compare `Execution Time` on staging (target: sub-100 ms for discovery portion at ~1k providers — align with Req 10.1 in follow-up task 53/perf SLOs).
