# Execution declaration audit trail

Client **declaração de execução** (checkbox on the manual confirm path) is persisted as an auditable row distinct from **confirmação com avaliação**.

**Why separate?** The checkbox is a declaration gesture with device/IP metadata; the final submit is a state transition + rating. Collapsing them would lose an audit checkpoint and couple UI debounce/retry to the confirm RPC.

**Collection:** Capacitor `@capacitor/device` (+ web `userAgent` fallback). Approximate location comes from **IP geolocation on the Edge** (`ipwho.is`) — no GPS permission. Geo lookup failure (including HTTP 429) stores `ip_geo` null and does not block the declaration.

**ipwho.is free plan (current):** [docs](https://ipwhois.io/documentation) — **1,000 requests / day**, shared by the Edge egress IP (not per end-user). Commercial use allowed; no uptime SLA. When Orbit exceeds **~1,000 declaration geo lookups / day**, **upgrade to a paid ipwho.is plan** (or replace the provider) so city/region enrichment does not silently drop under quota. Until then, degraded geo (`ip_geo` null) is acceptable; IP + device metadata still persist.

**Gates:** UI hard-gates “Continuar para avaliação” until the declaration row is persisted; `service_completion_confirm_with_rating` raises `EXECUTION_DECLARATION_REQUIRED` if missing. Auto-complete does not require a declaration. Unchecking does not delete the row; `declared_at` is immutable on upsert.

**Privacy:** table is RLS deny-by-default with **no authenticated SELECT**. Reads are `service_role` / admin only.
