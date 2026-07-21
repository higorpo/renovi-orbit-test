# Leftover PROCESSING policy (CHK-021 / CHK-022)

## When a schedule stays in `PROCESSING`

| Cause | Immediate action | Recovery |
|-------|------------------|----------|
| `createCharge` succeeded, `payment_commit_charge_outcome` fails even after `getTransaction` + retry | CRITICAL `CHARGE_COMMIT_AFTER_SUCCESS_FAILED`; rethrow; schedule left `PROCESSING` | Lease TTL → `payment_recover_orphaned_schedules` → usually `IN_ANALYSIS` → reconcile EF |
| Invoke wall-clock deadline reached mid-batch | Unstarted claimed rows counted as `skipped_deadline`; left `PROCESSING` | Same orphan path after `locked_until` |
| EF crash / pg_net abort mid-batch | Claimed rows remain `PROCESSING` | Orphan janitor (`*/30`) **and** pre-claim orphan in next `schedule-netcred-charges` tick |

## Guarantees

1. **Money path ≠ notification path** — MMD / `payment_enqueue_notifications` failures are logged (`notification_enqueue_failed`) and never roll back a successful commit.
2. **Commit after gateway success** — one immediate `getTransaction(referenceCode)` + commit retry before CRITICAL + leave `PROCESSING`.
3. **Batch sizing** — default `charge_batch_size = 3` and EF hard deadline (~45s) keep sequential work under the charge-cron pg_net timeout (90s for `schedule-netcred-charges`).
4. **Orphan before claim** — each EF tick calls `payment_recover_orphaned_schedules` before `payment_claim_charge_batch` (same pattern as `cron_payment_charge_batch`).

## Non-goals

- Do not wrap NetCred HTTP inside a Postgres transaction.
- Do not release leases mid-tick without orphan semantics (avoid double-charge races).
