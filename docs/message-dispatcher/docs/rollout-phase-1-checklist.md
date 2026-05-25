# MMD rollout — Phase 1 (DB + RPCs + cron, worker disabled)

Design §13.1, task 119. **No external send** until Phase 2.

## Pre-deploy

- [ ] Tasks 1–80 and 88–110 green in CI (pgTAP + Edge unit tests)
- [ ] Review migration order: `20260621100000` → `20260621100100` → `20260621100200` → `20260621100300`
- [ ] Staging backup / maintenance window communicated

## Deploy (staging → production)

1. Apply migrations 00000–00300 (`yarn db:migrate` or Supabase dashboard).
2. Run `yarn generate-supabase-types` after apply (task 111).
3. **Disable worker invoke** (Phase 1): execute `supabase/scripts/mmd-rollout-phase1-disable-worker.sql`.
4. Confirm cron jobs **active**:
   - `mmd_activate_scheduled`
   - `mmd_promote_retries`
   - `mmd_reclaim_leases`
   - `mmd_refresh_stats` (optional gauges)
5. Confirm `mmd_invoke_worker` is **not** scheduled (or inactive).

## Smoke tests (service_role)

Run `supabase/scripts/mmd-rollout-phase1-smoke.sql` or automated pgTAP `rollout_phase1_smoke_test.sql`.

| Check | Expected |
|-------|----------|
| Ingest `source_system = mmd_smoke_test` | Row created `QUEUED` or `SCHEDULED` / evaluation outcome |
| Cancel smoke dispatch | `CANCELED` |
| Future `SCHEDULED` dispatch | **Not** returned by `checkout_batch` |
| `activate_scheduled` | Promotes due rows |
| `reclaim_leases` | Reclaims stale `PROCESSING` |

Manual staging only (no Resend/FCM): `checkout_batch(p_limit := 1)` allowed; do not configure `message_dispatcher.worker_url` / `cron_secret`.

## Rollback (no schema drop)

```sql
select cron.unschedule(jobid)
from cron.job
where jobname like 'mmd_%';
```

Retains `message_dispatcher` schema, dispatches, and audit for forensics.

## Sign-off

| Role | Name | Date | Environment |
|------|------|------|-------------|
| On-call | | | staging |
| On-call | | | production |

Record link: `rollout-phase-1-migration-record.md`
