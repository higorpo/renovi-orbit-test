# MMD Phase 1 — migration apply record

Template for on-call (task 119). Copy per environment.

## Environment

- **Target:** staging | production
- **Date (UTC):**
- **Operator:**
- **Git ref / migration set:** `20260621100000` … `20260621100300`

## Apply log

| Step | Command / action | Result | Notes |
|------|------------------|--------|-------|
| 1 | Apply migrations | ☐ OK ☐ Fail | |
| 2 | `mmd-rollout-phase1-disable-worker.sql` | ☐ OK ☐ Fail | |
| 3 | Verify cron (activate, promote, reclaim) | ☐ OK ☐ Fail | |
| 4 | Phase 1 smoke SQL / pgTAP | ☐ OK ☐ Fail | |
| 5 | `yarn generate-supabase-types` (if app deploy follows) | ☐ OK ☐ N/A | |

## Smoke summary

- Ingest `mmd_smoke_test`: dispatch_id `________________`
- Cancel: ☐ pass
- SCHEDULED excluded from checkout: ☐ pass
- Worker cron disabled: ☐ pass

## Issues / rollback

_None_ |

Rollback executed: ☐ No ☐ Yes — `cron.unschedule` all `mmd_%` jobs
