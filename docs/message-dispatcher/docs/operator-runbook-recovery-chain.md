# MMD operator runbook — recovery chain

How stuck or retryable work is recovered without Edge state. Source of truth: `design.md` §4.9, §8.5; Req. 3 AC3.

## Recovery pipeline (order matters)

```text
mmd_reclaim_leases (cron, */1)
    → FAILED_RETRYABLE or FAILED_TERMINAL (lease_expired)
mmd_promote_retries (cron, */1)
    → FAILED_RETRYABLE (due) → QUEUED
mmd_invoke_worker (cron, */1, pg_net)
    → POST message-dispatcher-worker
    → checkout_batch → PROCESSING + lease
    → render / send / report_delivery_outcome
```

**Recommended ops order:** reclaim **before** promote (already how crons are scheduled in migration `20260621100300`).

## 1. Stuck `PROCESSING` (orphan lease)

**Symptoms:** dispatch `status = PROCESSING`, `locked_until` in the past, no worker progress.

**Automatic:** `message_dispatcher_reclaim_leases()` every minute (`mmd_reclaim_leases`).

**Manual (staging / break-glass, `service_role`):**

```sql
select message_dispatcher.message_dispatcher_reclaim_leases();
-- returns integer rows reclaimed
```

**Verify:**

```sql
select id, status, failure_code, retry_count, next_retry_at, locked_until, locked_by
from message_dispatcher.message_dispatches
where id = '<dispatch_id>';
```

If `retry_count < max_retries` → `FAILED_RETRYABLE` with `failure_code = lease_expired` and new `next_retry_at`.  
If `retry_count >= max_retries` → `FAILED_TERMINAL` (dead-letter).

## 2. Retryable backlog (`FAILED_RETRYABLE`)

**Automatic:** `message_dispatcher_promote_retries()` (`mmd_promote_retries`) moves rows where `next_retry_at <= now()` → `QUEUED`.

**Monitor depth:**

```sql
select count(*) from message_dispatcher.message_dispatches
where status = 'FAILED_RETRYABLE';
-- also in message_dispatcher_stats: mmd_retryable_failures
```

**Manual promote:**

```sql
select message_dispatcher.message_dispatcher_promote_retries();
```

## 3. Worker drain (`QUEUED` → delivery)

**Automatic:** `message_dispatcher_invoke_worker()` via `mmd_invoke_worker` when `platform_constants` has non-empty `message_dispatcher.worker_url` and `message_dispatcher.cron_secret`.

**Manual invoke (curl):**

```bash
curl -X POST "$WORKER_URL" \
  -H "Authorization: Bearer $DISPATCHER_CRON_SECRET" \
  -H "X-Dispatcher-Secret: $DISPATCHER_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Manual checkout only (no provider I/O):**

```sql
select message_dispatcher.message_dispatcher_checkout_batch(
  p_worker_id := 'manual-ops-' || gen_random_uuid()::text,
  p_limit := 1
);
```

## 4. Scheduled activation

`mmd_activate_scheduled` runs `message_dispatcher_activate_scheduled()` for `SCHEDULED` rows due by `scheduled_for`.

## Janitor alert

High `lease_expired` churn: `alert_janitor_churn_v` / `mmd_alert_janitor_churn` (threshold 100/min, design §10.5).

## Stale worker completion

If a worker finishes **after** reclaim, `report_delivery_outcome` no-ops when status is no longer `PROCESSING` or `locked_by` mismatches — safe at-most-once semantics.

## Related docs

- `operator-runbook-dead-letter.md`
- `poison-message-policy.md`
- `metrics-catalog.md`
