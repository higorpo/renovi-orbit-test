# MMD metrics catalog

Operational metrics for the Multichannel Message Dispatcher (MMD). Source of truth: `design.md` §10.2; implementation hooks in RPCs, `pg_cron`, and Edge worker logs.

## Naming convention

- Prefix: `mmd_`
- Types: `counter`, `gauge`, `histogram` (Prometheus-compatible labels in `{key=value}` form)
- Dimensions commonly used: `channel` (`email` | `push`), `status` (FSM enum), `source_system`, `reason` (reject codes)

## Core metrics (design §10.2)

| Metric | Type | Labels | Emitted from | Notes |
|--------|------|--------|--------------|-------|
| `mmd_ingest_total` | counter | `channel`, `status`, `source_system` | `message_dispatcher_ingest` | Increment on each ingest attempt: `created`, `duplicate`, or terminal reject before INSERT. |
| `mmd_checkout_latency_ms` | histogram | `worker_id` (optional) | Edge `message-dispatcher-worker` | Wall time for `message_dispatcher_checkout_batch` RPC (span `checkout`). Buckets: 50, 100, 250, 500, 1000, 2500, 5000 ms. |
| `mmd_delivery_success_total` | counter | `channel` | Edge worker after `report_delivery_outcome` | Increment when RPC returns `applied` and success path (email send OK, push any-device success). |
| `mmd_retryable_failures` | counter | `channel`, `error_code` | Edge worker + `message_dispatcher_report_delivery_outcome` | HTTP 429/5xx classified retryable; also gauge-friendly count of rows in `FAILED_RETRYABLE`. |
| `mmd_lease_reclaims` | counter | — | `message_dispatcher_reclaim_leases` | One increment per row moved `PROCESSING` → `QUEUED` with `failure_code = lease_expired`. |
| `mmd_queue_depth` | gauge | `status` | Cron scrape or ad-hoc SQL | Snapshot `count(*)` grouped by `message_dispatches.status`. |

## Supplementary metrics (tasks / alerts)

| Metric | Type | Labels | Emitted from | Notes |
|--------|------|--------|--------------|-------|
| `mmd_ingest_rejected_total` | counter | `reason` | `message_dispatcher_ingest` | e.g. `missing_idempotency`, quota exceeded. |
| `mmd_worker_run_total` | counter | `outcome` | Edge worker | `succeeded`, `failed`, `rate_limited`, `checkout_failed`. |
| `mmd_webhook_events_total` | counter | `event_type`, `outcome` | `message-dispatcher-webhook-resend` | After Svix verify + `message_dispatcher_reconcile_vendor_event`. |

## Collection strategies

### 1. Structured logs → Logflare (MVP)

Edge worker and webhook already use `_shared/logger` with `correlation_id`, `dispatch_id`, `channel`. Map log events to counters in Logflare parsers:

| Log event (worker) | Suggested metric |
|--------------------|------------------|
| `worker.run.completed` | `mmd_worker_run_total{outcome=completed}` |
| `worker.checkout.failed` | `mmd_worker_run_total{outcome=checkout_failed}` |
| `worker.email.sent` / `worker.push.sent` | `mmd_delivery_success_total` |
| `worker.email.send_failed` / `worker.push.send_failed` | `mmd_retryable_failures` (when `retryable=true`) |
| `span.finished` with `span=checkout` | `mmd_checkout_latency_ms` from `duration_ms` |

Sentry spans (task 81): `checkout`, `render`, `provider_http`, `report_outcome` — use for trace latency, not primary counters.

### 2. SQL gauges (queue depth, retryable backlog)

Run on a 1-minute cron via `mmd_refresh_stats` → `message_dispatcher_refresh_stats()` into `message_dispatcher_stats`:

```sql
-- mmd_queue_depth by status
select status::text as status, count(*)::bigint as depth
from message_dispatcher.message_dispatches
group by status;

-- FAILED_RETRYABLE backlog (feeds mmd_retryable_failures gauge)
select count(*)::bigint as depth
from message_dispatcher.message_dispatches
where status = 'FAILED_RETRYABLE';

-- Queue lag alert input (design §10.5)
select count(*)::bigint as lag_count
from message_dispatcher.message_dispatches
where status = 'QUEUED'
  and scheduled_for < now() - interval '5 minutes';
```

### 3. RPC-side counters (DB logs / extensions)

`message_dispatcher_reclaim_leases` SHOULD log `reclaimed_count`; operators derive `mmd_lease_reclaims` from that field or:

```sql
select count(*)::bigint
from message_dispatcher.message_dispatches
where status = 'QUEUED'
  and failure_code = 'lease_expired'
  and updated_at > now() - interval '1 minute';
```

`message_dispatcher_checkout_batch` batch size and duration belong in DB logs for histogram derivation.

## Alert mapping (design §10.5, task 84)

| Alert | SQL view | Threshold | Stats row after refresh |
|-------|----------|-----------|-------------------------|
| Queue lag | `alert_queue_lag_v.lag_count` | > 1000 | `mmd_alert_queue_lag` |
| Terminal spike | `alert_terminal_spike_v.terminal_rate` | > 5% over 15m ingest cohort | `mmd_alert_terminal_spike` (rate × 10000) |
| Janitor churn | `alert_janitor_churn_v.lease_reclaims_1m` | > 100/min | `mmd_alert_janitor_churn` |
| Retryable depth | `alert_retryable_depth_v.retryable_count` | > 10k (configurable) | `mmd_alert_retryable_depth` |

Triage by producer: `alert_retryable_by_source_v` (design §9.5, task 109). Playbook: `operator-runbook-backpressure.md`.

Ops RPC: `select message_dispatcher.message_dispatcher_evaluate_alerts();` returns JSON with `breached` per alert.

## Dashboards (recommended panels)

1. **Queue health** — `mmd_queue_depth` stacked by status; lag query overlay.
2. **Worker** — `mmd_checkout_latency_ms` p50/p95; `mmd_worker_run_total`.
3. **Delivery** — `mmd_delivery_success_total` vs `mmd_retryable_failures` by channel.
4. **Recovery** — `mmd_lease_reclaims`; `FAILED_RETRYABLE` depth.

## Related docs

- `design.md` §10.1–10.6 (correlation, tracing, alerts, dead-letter)
- `operator-runbook-immutable-fields.md`
- `message_dispatcher_stats` table — scraped by Logflare (`service_role` SELECT)
