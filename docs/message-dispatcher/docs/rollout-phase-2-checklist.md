# MMD rollout — Phase 2 (GA: worker, webhook, monitoring)

Design §13.1, §8.5, task 120. Requires **Phase 1** complete (task 119).

## Pre-GA gates

- [ ] Phase 1 signed off (`rollout-phase-1-migration-record.md`)
- [ ] Integration tests 88–93, 100, 103 green
- [ ] Coverage tasks 121–125 green (≥80% MMD unit metrics) — or waived with ticket
- [ ] Staging: worker + webhook deployed; Resend Svix verified
- [ ] `yarn generate-supabase-types` current (task 111)
- [ ] Orbit wrappers available (tasks 112–115)

## Secrets and platform_constants

| Item | Where |
|------|--------|
| `DISPATCHER_CRON_SECRET` | Edge secret + `message_dispatcher.cron_secret` |
| Worker URL | `message_dispatcher.worker_url` → `https://<project>.supabase.co/functions/v1/message-dispatcher-worker` |
| `RESEND_API_KEY`, `FCM_SERVICE_ACCOUNT` | Edge worker secrets |
| `RESEND_WEBHOOK_SECRET` | Webhook Edge + Resend dashboard URL |
| `SENTRY_DSN` (optional) | Worker / webhook |

See `edge-secrets.md`.

## Deploy Edge functions

```bash
supabase functions deploy message-dispatcher-worker
supabase functions deploy message-dispatcher-webhook-resend
supabase functions deploy message-dispatcher-ingest
```

Register Resend webhook → `.../message-dispatcher-webhook-resend`.

## Enable worker cron

After secrets validated in staging:

```bash
psql ... -f supabase/scripts/mmd-rollout-phase2-enable-worker.sql
```

Confirms `mmd_invoke_worker` schedule `*/1 * * * *` (RPC throttle ≥15s between pg_net POSTs).

## Canary (24h)

- Restrict ingest to `source_system IN ('matching')` or ≤1% volume at producer
- Alerts (task 84, 109): `evaluate_alerts()` / Logflare `mmd_alert_*`
- SLO: `FAILED_TERMINAL` rate &lt; 5% / 15m ingest cohort (`alert_terminal_spike_v`)

## Monitoring

- Dashboard panels: `metrics-catalog.md` (queue depth, worker runs, retryable depth)
- Runbooks: dead-letter, recovery chain, backpressure

## Rollback (one command, no data loss)

```bash
psql ... -f supabase/scripts/mmd-rollout-phase2-rollback.sql
```

1. Unschedule `mmd_invoke_worker` (stops outbound send)
2. Optionally clear `message_dispatcher.worker_url` in `platform_constants`
3. Dispatches and audit remain for forensics
4. Emergency: revoke `EXECUTE` on `checkout_batch` / `report_delivery_outcome` from `service_role` only if worker cannot be stopped (see script comments)

## Sign-off

| Role | Name | Date | Environment |
|------|------|------|-------------|
| On-call | | | staging GA |
| On-call | | | production GA |

Record: `rollout-phase-2-migration-record.md`
