# ADR 0004: Dispatch gates, cron phases, and `next_batch_at` scheduling

**Status:** Accepted (2026-06-17)

## Context

Progressive dispatch must pause/resume based on proposal caps (CNS), chat activity, pool exhaustion, and lifecycle expiry — without opening batches or sending notifications at the wrong time. Grill decisions #82–#112 refined gate priority, inline vs cron evaluation, and `next_batch_at` semantics.

## Decision

### Gate priority ladder (non-terminal)

Persist **one** operational status per service request dispatch:

1. **`DISPATCH_STOPPED`** — in-flight proposals (`PENDING` + `REVISION_REQUESTED`) ≥ `chats.max_active_slots_per_service_request` (default 4). Blocks **new proposals only**; new chats follow CNS slots (#88).
2. **`DISPATCH_PAUSED`** — active chats (≥1 message in `matching.dispatch_active_chat_window_hours`, default 24 h) ≥ `matching.dispatch_pause_active_chat_threshold` (default 10).
3. **`DISPATCH_FALLBACK_OPEN_MARKET`** — when `fallback_opened_at IS NOT NULL` (pool exhausted; lazy feed eligibility).
4. **`DISPATCH_ACTIVE`** — progressive batches continue.

`STOPPED`/`PAUSED` **may replace** a prior `FALLBACK_OPEN_MARKET` status; `fallback_opened_at` is retained until match/cancel/terminal events (#85).

Terminal states **`MATCHED`**, **`CANCELLED`**, **`EXPIRED`** are **immutable** — `evaluate_service_request_dispatch_gates` is a no-op (#86).

### Shared gate helper

`evaluate_service_request_dispatch_gates(service_request_id)`:

| Invoked from | Opens batch? |
|--------------|--------------|
| Proposal-mutating CNS RPCs (same transaction) | **No** (#107) |
| `expire_pending_proposals` (once per distinct affected SR) | **No** (#105) |
| `cron_process_service_request_dispatches` phase 2 — **before** discovery on due rows (#112) | **Yes** (phase 2 only) |
| Phase 2 — `PAUSED`/`STOPPED` rows (gate-only pass) | **No** (#104) |

**Not** invoked on every `send_message` — chat-activity decay is picked up by cron (~2 min).

### Cron worker (`cron_process_service_request_dispatches`, ~2 min)

**Phase 1 — lifecycle sweep:** all non-terminal dispatches past `matching.dispatch_lifecycle_hours` from `service_request_dispatches.created_at` → `DISPATCH_EXPIRED` (#91, #103).

**Phase 2 — batch/gate processing** (lease per row, #68):

1. Due `next_batch_at`: evaluate gates **first** (#112); open batch only if status is `PENDING` or `ACTIVE` after evaluation.
2. `PAUSED`/`STOPPED`: gate re-evaluation only (#104).

Batch open (discovery, visibility, MMD enqueue) happens **only** in phase 2 — never in inline gate callers (#107).

### `next_batch_at` rules

| Event | `next_batch_at` |
|-------|-----------------|
| Enter `STOPPED` or `PAUSED` | `NULL` (#108) |
| Enter/resume `FALLBACK_OPEN_MARKET` | `NULL` (#109) |
| Resume to `ACTIVE` from gates | `now()` (#106) |
| Successful batch open while `ACTIVE` | `now() + matching.batch_interval_minutes` (#110) |
| Bootstrap (`DISPATCH_PENDING`) | `now() + matching.dispatch_start_delay_minutes` (#60, #99) |

Partial batches (1–9 eligible providers) still open and schedule the next attempt (#111). Zero new eligible → fallback (#21).

## Consequences

- **Positive:** Clear separation between state transitions (inline) and side effects (cron batch open).
- **Positive:** Immediate resume from `STOPPED` when proposals expire via `expire_pending_proposals` (#105).
- **Negative:** Up to ~2 min delay between gate clearing and batch open when resume sets `next_batch_at = now()`.
- **Implementation:** Lease columns on `service_request_dispatches`; `job_runs` observability (#68).

See also: `docs/matching-algorithm/CONTEXT.md` decisions #82–#112, #103–#112; `requirements.md` § Dispatch State Machine.
