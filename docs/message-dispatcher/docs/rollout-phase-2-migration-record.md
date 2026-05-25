# MMD Phase 2 — GA rollout record

Template for on-call (task 120).

## Environment

- **Target:** staging | production
- **Date (UTC):**
- **Operator:**
- **Phase 1 ref:**

## Enable log

| Step | Action | Result | Notes |
|------|--------|--------|-------|
| 1 | Deploy Edge functions (worker, webhook, ingest) | ☐ OK ☐ Fail | |
| 2 | Set Edge + `platform_constants` secrets | ☐ OK ☐ Fail | |
| 3 | Resend webhook registered + test event | ☐ OK ☐ Fail | |
| 4 | `mmd-rollout-phase2-enable-worker.sql` | ☐ OK ☐ Fail | |
| 5 | Canary `source_system=matching` 24h | ☐ OK ☐ Fail | |
| 6 | Alerts breaching? | ☐ None ☐ See notes | |

## Canary metrics (24h window)

- Terminal rate (15m): _______
- Queue lag alert: ☐ clear ☐ breached
- Retryable depth: _______

## Rollback

Executed: ☐ No ☐ Yes — `mmd-rollout-phase2-rollback.sql` at _______
