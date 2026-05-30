# CNS operational metrics and alert thresholds

Runbook for Chat Negotiation System (`cns_*`) observability. Normative source: [`docs/chats/design.md`](../chats/design.md) §10.3; requirement **R21-AC05** (proposal expiry SLA alert).

---

## Summary alerts (on-call)

| Alert | Condition | Severity | Primary signal |
|-------|-----------|----------|----------------|
| Send latency | `cns_send_message_duration_ms` **p95 > 1000** over 5m | **P2** | Postgres `RAISE LOG` / RPC traces |
| Domain events backlog | `cns_domain_events_backlog` **> 1000** for 10m | **P2** | `job_runs.metadata.backlog`, log line |
| Proposal expiry lag | `cns_proposal_expiry_lag_seconds` **> 1800** (30 min) | **P2** | `job_runs.metadata.max_lag_seconds`, log line |
| Slot rejection spike | `cns_slot_rejection_total` rate **> 3×** 24h baseline over 15m | **P3** | Postgres logs |
| Domain events dead letter | `cns_domain_events_dead_letter_total` **> 0** sustained 15m | **P2** | Postgres logs + `domain_events.status` |
| Cron job failure | `job_runs.error_count > 0` or missing `finished_at` for scheduled job | **P2** | `job_runs` table |

---

## Metrics catalog

### Core product path (design §10.3)

| Metric | Type | Emitted from | Log / storage pattern | Dashboard use |
|--------|------|--------------|----------------------|---------------|
| `cns_send_message_duration_ms` | histogram | `cns_send_message` RPC | `cns_send_message_duration_ms=% chat_id=% message_id=% message_type=% new_chat=%` | p50/p95/p99 send latency |
| `accept_proposal_total` | counter | `accept_proposal` RPC | `accept_proposal_total proposal_id=% service_id=% service_request_id=%` | Accept funnel volume |
| `cns_active_chats_per_sr` | gauge | *(derived)* | Query `negotiation_stats.active_chat_count` by `service_request_id` | Capacity / slot pressure |
| `cns_reciprocity_transitions_total` | counter | `cns_evaluate_reciprocity_batch` | `cns_reciprocity_transitions_total chat_id=% service_request_id=%` | Inactivation rate |
| `cns_proposal_expiry_lag_seconds` | gauge | `expire_pending_proposals` cron | `cns_proposal_expiry_lag_seconds=% processed=% expired=% inactivated=%` | SLA compliance (R21-AC05) |
| `cns_domain_events_backlog` | gauge | `cns_process_domain_events` cron | `cns_domain_events_backlog=% processed=% succeeded=% failed=% dead_lettered=%` | Outbox health |
| `cns_slot_rejection_total` | counter | `cns_send_message` (new chat) | `cns_slot_rejection_total service_request_id=% active_chat_count=% slot_limit=%` | Demand vs slot limits |

### Supporting pipeline metrics

| Metric | Type | Emitted from | Notes |
|--------|------|--------------|-------|
| `cns_domain_events_dead_letter_total` | counter | `cns_process_domain_events` | Row moved to dead letter after max retries |
| `cns_process_domain_events` row errors | counter | `cns_process_domain_events` | `cns_process_domain_events row_error event_id=%` |
| `cns_notification_enqueue_total` | counter | `cns_enqueue_notifications` | MMD fan-out |
| `cns_mmd_ingest_duration_ms` | histogram | `cns_mmd_ingest` | Notification ingest latency |
| `cns_delivery_reconcile_total` | counter | `cns_reconcile_pending_deliveries` | Delivery state repair |
| `cns_orphan_media_bytes_deleted` | counter | `cns_janitor_orphan_media` | Storage cleanup |
| `cns_media_attach_total` | counter | `cns_attach_message_media` | Media attach success path |
| `cns_upload_validation_total` | counter | `cns_validate_upload_session` | Pre-upload validation |
| `cns_send_message_idempotency_hit` | counter | `cns_send_message` | Duplicate client retries (benign) |

---

## Cron jobs and `job_runs`

All CNS batch entrypoints record runs in `public.job_runs` (task 64):

| `job_name` | Schedule (pg_cron) | Wrapper RPC |
|------------|-------------------|-------------|
| `chat_evaluate_reciprocity` | `*/10 * * * *` | `cron_chat_evaluate_reciprocity()` |
| `proposal_expire_pending` | `*/10 * * * *` | `cron_proposal_expire_pending()` |
| `cns_process_domain_events` | `* * * * *` | `cron_cns_process_domain_events()` |
| `cns_janitor_orphan_media` | *(see migration 048)* | `cron_cns_janitor_orphan_media()` |
| `cns_reconcile_pending_deliveries` | *(see migration 050)* | `cron_cns_reconcile_pending_deliveries()` |

**Useful queries:**

```sql
-- Latest run per CNS job (last 24h)
select distinct on (job_name)
  job_name,
  started_at,
  finished_at,
  duration_ms,
  processed_count,
  transitioned_count,
  error_count,
  metadata
from public.job_runs
where job_name like 'cns_%'
   or job_name in ('chat_evaluate_reciprocity', 'proposal_expire_pending')
  and started_at > now() - interval '24 hours'
order by job_name, started_at desc;

-- Domain events backlog (live)
select count(*) as backlog
from public.domain_events
where status in ('pending', 'processing');

-- Proposal expiry lag (worst overdue PENDING proposal)
select coalesce(
  max(extract(epoch from (now() - pp.expires_at))),
  0
)::bigint as max_lag_seconds
from public.provider_proposals pp
where pp.status = 'PENDING'
  and pp.expires_at is not null
  and pp.expires_at < now();
```

---

## Alert definitions (Grafana / log-based)

### 1. Send latency — p95 > 1s

- **Source:** parse `cns_send_message_duration_ms=<ms>` from Postgres logs.
- **Window:** 5 minutes rolling.
- **Threshold:** p95 > **1000** ms.
- **Action:** check DB load, lock waits on `service_requests` / `negotiation_stats`, recent migrations, connection pool saturation.

### 2. Domain events backlog — > 1000

- **Source:** `cns_domain_events_backlog=<n>` log line or `job_runs.metadata->>'backlog'`.
- **Window:** 10 consecutive minutes above threshold.
- **Threshold:** **> 1000** pending/processing rows.
- **Action:** verify `cns_process_domain_events` cron is running (`select * from cron.job where jobname = 'cns_process_domain_events'`), inspect `domain_events_release_stale_leases`, check for repeated `row_error` logs, scale batch size only after root-cause review.

### 3. Proposal expiry lag — > 1800s (30 min)

- **Source:** `cns_proposal_expiry_lag_seconds=<n>` or `job_runs.metadata->>'max_lag_seconds'` for `proposal_expire_pending`.
- **Window:** single observation above threshold (SLA breach).
- **Threshold:** **> 1800** seconds.
- **Action:** confirm `proposal_expire_pending` cron healthy; run manual batch `select public.expire_pending_proposals(500);` if needed; check for long transactions blocking proposal updates.

### 4. Slot rejection spike

- **Source:** rate of `cns_slot_rejection_total` log lines.
- **Window:** 15 minutes vs 24h baseline.
- **Threshold:** **> 3×** baseline (tune per environment).
- **Action:** product/ops review — may indicate slot limits too low or abuse; not necessarily infra failure.

---

## On-call playbook

1. **Confirm signal** — correlate Postgres log timestamp with `job_runs` row for the same minute.
2. **Check cron** — `select jobid, jobname, schedule, active from cron.job where jobname like 'cns_%' or jobname like '%proposal%' or jobname like '%reciprocity%';`
3. **Inspect errors** — `select * from job_runs where error_count > 0 order by started_at desc limit 20;`
4. **Dead letters** — `select id, event_type, retry_count, last_error from public.domain_events where status = 'dead_letter' order by updated_at desc limit 50;`
5. **Escalate** if backlog or expiry lag remains above threshold after one manual cron cycle and no obvious DB incident.

---

## Edge / frontend (cross-reference)

| Area | Doc / implementation |
|------|---------------------|
| Edge upload logs | `chat-upload-media` structured fields: `correlation_id`, `chat_id`, `service_request_id`, `idempotency_key` |
| Sentry (client) | `feature=chats`, tags `chat_id`, `service_request_id`; message text scrubbed |
| Product analytics (client) | [`src/lib/analytics/events.ts`](../../src/lib/analytics/events.ts) schema `v1` — post-RPC confirm only |

---

## Related requirements

- **R21-AC05** — expiry job delay alert (> 30 min).
- **R25-AC05** — cron batches instrumented via `job_runs`.
- **R28-AC02** — domain events processor cadence and backlog visibility.
