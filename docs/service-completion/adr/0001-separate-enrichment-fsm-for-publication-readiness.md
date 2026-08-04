# Separate enrichment FSM for publication readiness

Service-request publication readiness is owned by a dedicated **enrichment FSM**, not by `service_request_status` and not by matching dispatch state. Matching bootstraps only when enrichment reaches `READY` (after AI checklist materialization or template fallback).

**Why not extend `service_request_status` with `PROCESSING`?** That enum already means negotiation/contract lifecycle (`OPEN` / proposal-accepted `COMPLETED` / `CANCELLED`). Overloading it conflates “not yet enriched” with “not accepting proposals” and forces every reader of CNS/matching to special-case enrichment.

**Why not gate inside matching (`DISPATCH_PENDING` forever)?** Matching must remain a distribution subsystem; LLM/checklist generation is a different failure domain (retries, leases, fallback templates, observability).

**Trade-off accepted:** one more durable state machine and an explicit handoff “enrichment READY → matching bootstrap”, in exchange for clear ownership and operational isolation.
