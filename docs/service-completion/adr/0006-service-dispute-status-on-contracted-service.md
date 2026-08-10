# ADR-0006: Service dispute as status on `contracted_services`

## Status

Accepted — 2026-08-10

## Context

The MVP introduces **Disputa de serviço**: the client can pause the completion path after `EXECUTED` until platform ops resolve the case. Product also needs a distinct settlement hold from gateway **chargeback** (`payment_schedules.is_disputed`).

Two shapes were considered:

1. **Status on `contracted_services`** — add enum value `IN_DISPUTE` plus audit columns (`disputed_at`, `disputed_by`, `dispute_reason`, `dispute_resolved_at`).
2. **Separate dispute entity** (1:1 or 1:N table) with its own FSM, linked to the contracted service while CS stays `EXECUTED` (or another “open” status).

## Decision

Use **option 1**: `contracted_services.status = IN_DISPUTE` with audit columns on the same row.

## Consequences

**Pros**

- Existing gates (auto-complete, confirm-with-rating, cancel, list `derive_service_list_phase`, completion context) already key off `contracted_services.status` — one CAS update is enough.
- List phase `dispute`, badges, and earnings joins stay simple (no extra join for “is disputed?”).
- Matches the irreversible self-serve story: the contract is *in* dispute, not “executed with an open ticket”.

**Cons / trade-offs**

- Extending to multiple dispute rounds, reopen, or `IN_DISPUTE → CANCELLED` later may need a dedicated history table or a second status machine.
- Audit fields share the CS row; rich dispute messaging/inbox still needs other surfaces (out of MVP).
- Hard to reverse without a data migration if product later wants a full dispute aggregate root.

**Rejected for MVP:** separate entity — correct if we needed concurrent cases, reopen cycles, or admin inbox as first-class storage; overkill while resolve is a single privileged RPC and there is no admin UI.

## Related

- Glossary: [CONTEXT.md](../CONTEXT.md) — **Disputa de serviço**, decisão 33.
- RPCs: `service_completion_open_dispute`, `service_completion_admin_resolve_dispute`.
- Ops: resolve via SQL/`service_role` — [service-completion-monitoring.md](../service-completion-monitoring.md) (admin resolve runbook).
