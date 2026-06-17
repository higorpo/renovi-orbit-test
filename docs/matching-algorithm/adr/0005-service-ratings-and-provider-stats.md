# ADR 0005: Service ratings and provider quality/conversion stats

**Status:** Accepted (2026-06-17)

## Context

Provider ranking uses quality (ratings) and proposal conversion signals. Grill decisions #5–#7, #15, #33–#34, #63, and #121–#134 define schema, RPC-only writes, bootstrap rows, trigger-based aggregates, and platform constant helpers.

## Decision

### Schema

- **`service_ratings`** — one row per `contracted_service_id` (UNIQUE); fixed dimension columns 1–5; optional comment.
- **`provider_rating_stats`** — denormalized quality aggregate per provider.
- **`provider_proposal_stats`** — denormalized conversion aggregate per provider.

### Writes (RPC-only, #63)

| RPC | Behavior |
|-----|----------|
| `submit_service_rating` | Requires `contracted_services.status = COMPLETED` and `client_id = auth.uid()` (#133). Rejects if rating already exists (#128). Computes **`overall_score` in RPC** from `platform_constants` dimension weights (#121). |
| `update_service_rating` | Same client eligibility; rejects after **`submitted_at + 48 hours`** (hardcoded, #123, #134). |

Direct INSERT/UPDATE on `service_ratings` denied for `authenticated` (RLS).

### Reads (RLS)

| Actor | Access |
|-------|--------|
| Client (`client_id`) | SELECT own rating row (#125) |
| Provider (`provider_id`) | SELECT individual ratings received (#56) |
| Public | Aggregates via **`provider_rating_stats` only** (`anon` + `authenticated`, #71) |

### Bootstrap on provider profile creation (#122, #130)

When `profiles.role` becomes `provider`:

- `provider_rating_stats`: `rating_count = 0`, `ranking_quality_score = 5.0`
- `provider_proposal_stats`: `resolved_count = 0`, `ranking_conversion_score = 0.5`

Ranking uses **5.0 quality** until ≥ `matching.rating_min_count_for_ranking` (default 3) real ratings (#7); conversion neutral **0.5** until ≥ `matching.conversion_min_resolved_for_ranking` (default 3).

### Aggregate refresh (triggers, not inline in RPCs)

| Trigger | Refreshes |
|---------|-----------|
| `AFTER INSERT/UPDATE/DELETE` on `service_ratings` | `provider_rating_stats` (#127) |
| Terminal `provider_proposals.status` transition | `provider_proposal_stats` (#132) |

CNS proposal RPCs do **not** recalculate conversion stats inline.

### Platform constants (migration #98, #131)

- Seeds migration contains **only** `platform_constant_numeric` helper + `matching.*` INSERTs.
- Fractional keys (weights, penalties) read via **`platform_constant_numeric`** (#124); GRANT to `service_role` + `authenticated` (#129).
- **Not seeded:** rating edit window 48 h (#123); discovery radius 20 km and pool cap 200 (#126) — hardcoded in SQL.

## Consequences

- **Positive:** Ranking joins always find stats rows; RPCs own validation and `overall_score` composition.
- **Positive:** Stats stay consistent via triggers even if maintenance paths touch underlying tables.
- **Negative:** Two bootstrap triggers + two refresh triggers to maintain.
- **Implementation:** See `requirements.md` Requirement 4 (schema side effect) and `platform_constants` table.

See also: `docs/matching-algorithm/CONTEXT.md` decisions #5–#7, #15, #33–#34, #63, #71, #121–#134.
