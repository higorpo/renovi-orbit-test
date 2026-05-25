# MMD operator runbook — immutable fields

Operational reference for support and on-call engineers. Source of truth: `design.md` §2.4, §13.9.

## Purpose

Prevent data corruption and ambiguous delivery by treating certain columns and tables as **immutable** or **append-only**. Direct `UPDATE` on `message_dispatches.status` is forbidden for clients; FSM changes MUST go through RPCs.

## Immutable after INSERT

| Field | Table | Rule |
|-------|-------|------|
| `idempotency_key` | `message_dispatches` | Set once at ingest. `UNIQUE` enforces replay safety. Never change in place; duplicate ingest returns existing row. |
| `correlation_id` | `message_dispatches` | Stable for logs, Resend `Idempotency-Key`, FCM `collapse_key`. Do not reassign on retry or reclaim. |
| `profile_id` | `message_dispatches` | Recipient identity at ingest time. |
| `channel`, `template_key` | `message_dispatches` | Channel/template pair validated at ingest. |

## Immutable after `QUEUED`

| Field | Table | Rule |
|-------|-------|------|
| `template_variables` | `message_dispatches` | Frozen once the dispatch enters the worker queue. Prevents mid-flight payload tampering. Fix via new ingest with a new `idempotency_key`, not `UPDATE`. |

## Immutable after checkout (push)

| Field | Table | Rule |
|-------|-------|------|
| `fcm_token_snapshot` | `message_dispatch_deliveries` | Token copied at checkout. Worker MUST NOT read live `user_device_beacons` during send. |

## Append-only tables

| Table | Policy |
|-------|--------|
| `message_dispatcher_audit` | `INSERT` only (trigger on parent status change). **Never** `UPDATE` or `DELETE` rows. Forward-fix mistakes with a new audit note via product process, not SQL edits. |
| `message_dispatcher_vendor_events` | Insert-only webhook ingress. `ON CONFLICT DO NOTHING` on `vendor_event_id`. |

## Mutable only via RPC

| Field | Rule |
|-------|------|
| `status` | FSM transitions via `message_dispatch_status_allowed` + BEFORE UPDATE trigger (`P0001` on illegal transition). |
| `retry_count` | Increment only through failure/completion RPCs (monotonic). |
| `locked_until`, `locked_by` | Set at checkout; cleared on completion or janitor reclaim. |

## Terminal states

`DELIVERED`, `CANCELED`, and `FAILED_TERMINAL` have **no outbound** FSM transitions. `FAILED_TERMINAL` is a dead-letter: no automatic requeue in MVP.

## Operator actions (allowed)

1. **Read** own dispatches / audit / deliveries via PostgREST (`authenticated` + RLS).
2. **Cancel** eligible dispatches via `message_dispatcher_cancel` (not while `PROCESSING` / `DELIVERED` — HTTP 409).
3. **Reconcile** vendor events via webhook + `message_dispatcher_reconcile_vendor_event` (`service_role`).
4. **Dead-letter review** — query `FAILED_TERMINAL` by `failure_code` / `failure_reason`; manual re-ingest only with a **new** `idempotency_key` if product approves.

## Operator actions (forbidden)

- `UPDATE message_dispatches SET status = …` (bypasses FSM and audit).
- `UPDATE` / `DELETE` on `message_dispatcher_audit`.
- Changing `idempotency_key`, `correlation_id`, or post-`QUEUED` `template_variables`.
- Editing `fcm_token_snapshot` on delivery rows.

## Verification checklist

- [ ] Ingest always supplies non-null `p_idempotency_key`.
- [ ] Support tools use `message_dispatcher_audit_timeline` (indexed by `dispatch_id` / `profile_id` + `created_at`).
- [ ] Incidents use `correlation_id` across Edge logs and audit rows.

## Related docs

- FSM matrix: `design.md` §4.8
- `operator-runbook-dead-letter.md`
- `operator-runbook-recovery-chain.md`
- `poison-message-policy.md`
- Migration seeds: `20260621100000_create_message_dispatcher_schema_enums_tables.sql`
