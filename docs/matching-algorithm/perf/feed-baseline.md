# Feed baseline — `list_provider_opportunities`

Captured for **matching task 53** (Req 13.1, 13.9). p95 SLO target **< 500 ms** (#1.5); alert threshold **> 800 ms** (#10.4).

## Environment

| Item | Value |
|------|--------|
| Date | 2026-06-18 |
| Database | Supabase local |
| Provider | `5d09e025-20a2-4842-aeef-324d42a431e1` (seed) |
| Batch visibility rows | 1 (+ seed OPEN SRs) |
| Default page size | 20 (max 50) |
| Chat activity window | `matching.dispatch_active_chat_window_hours` (24 h) |

## How to reproduce

```bash
cat supabase/scripts/matching-feed-explain-baseline.sql \
  | docker exec -i supabase_db_<container_id> psql -U postgres -d postgres
```

Visibility index probe (provider-first):

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT v.service_request_id, v.granted_at
FROM public.service_request_provider_visibility v
WHERE v.provider_id = '<provider_uuid>'
  AND v.source = 'batch'
  AND v.revoked_at IS NULL
  AND v.dismissed_at IS NULL
ORDER BY v.granted_at DESC
LIMIT 21;
```

> Full RPC uses `CREATE TEMP TABLE` inside PL/pgSQL — use timing (`\timing on`) in an interactive session for end-to-end latency, not `EXPLAIN` on the function call.

## Indexes under test

| Object | Index | Role |
|--------|--------|------|
| `service_request_provider_visibility` | `srv_visibility_feed_idx` `(provider_id, granted_at DESC)` partial | Primary feed driver |
| `service_request_provider_visibility` | `service_request_provider_visibility_batch_unique` | Per-SR join |
| `provider_proposals` | `provider_proposals_unique_active`, `provider_proposals_provider_request_latest_idx` | Exclusion semi-joins |
| `chats` | `chats_provider_id_status_last_interaction_at_idx` | Active-chat exclusion |
| `service_request_dispatches` | `service_request_dispatches_sr_id_unique` | Dispatch status gate |

**Index adjustment:** None required at seed scale. Chat anti-join may seq-scan when `chats` is tiny (planner choice); existing `(provider_id, status, last_interaction_at)` index should engage at production row counts.

## Acceptance checklist

| Criterion | Result |
|-----------|--------|
| `srv_visibility_feed_idx` used for provider feed scan | **Pass** — Index Scan on provider-first query |
| Proposal exclusions index-backed | **Pass** — `provider_proposals_unique_active`, `provider_proposals_provider_request_latest_idx` |
| Batch arm execution time (seed) | **Pass** — ~0.6 ms (≪ 500 ms p95 target) |
| Visibility index scan (seed) | **Pass** — ~0.06 ms |

---

## Plan A — `srv_visibility_feed_idx` (provider-first)

```
 Limit  (actual time=0.017..0.024 rows=1)
   ->  Index Scan using srv_visibility_feed_idx on service_request_provider_visibility v
         Index Cond: (provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid)
 Execution Time: 0.063 ms
```

This is the intended access path for paginated feed pages sorted by `granted_at DESC`.

---

## Plan B — Batch arm with exclusion semi-joins

Extracted from `feed_candidates` batch branch (newest sort, limit 21).

```
 Limit  (actual time=0.414..0.416 rows=1)
   ->  Sort  (Sort Key: v.granted_at DESC, sr.id)
         ->  Merge Anti Join  (provider_proposals history exclusion)
               ->  Nested Loop  (OPEN SRs + dispatch + visibility)
                     ->  Nested Loop Anti Join  (pending proposal exclusion)
                           ->  Nested Loop Anti Join  (active chat exclusion)
                                 ->  Index Scan using service_requests_open_id_idx on service_requests sr
                                 ->  Nested Loop Semi Join
                                       ->  Seq Scan on chats c  (18 loops — tiny table)
                                             Filter: provider_id = … AND status = ACTIVE …
                                       ->  Index Only Scan on chat_messages (never executed)
                           ->  Index Only Scan using provider_proposals_unique_active on provider_proposals pp
                     ->  Index Scan using service_request_provider_visibility_batch_unique on visibility v
               ->  Index Scan using provider_proposals_provider_request_latest_idx on provider_proposals pp_1
 Execution Time: 0.597 ms
```

**Observations**

- Visibility join uses **`service_request_provider_visibility_batch_unique`** when the planner drives from OPEN `service_requests`; provider-first pages still hit **`srv_visibility_feed_idx`** (Plan A).
- Chat exclusion: seq scan on `chats` at seed cardinality (~11 rows); index `chats_provider_id_status_last_interaction_at_idx` exists for scale-up.
- All proposal exclusion paths use index scans.

---

## Regression guidance

1. Re-run Plan A + Plan B after feed RPC or visibility schema changes.
2. Fail review if provider-first query loses `srv_visibility_feed_idx` at scale.
3. On staging with realistic visibility row counts, capture p95 via Edge + RPC timing; escalate if **> 500 ms** sustained.
4. If chat anti-join seq-scans persist at scale, consider `(provider_id, service_request_id)` partial index on `chats` where `status = 'ACTIVE'` (optional follow-up — not needed for MVP seed baseline).
