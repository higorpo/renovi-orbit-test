# MMD operator runbook — backpressure

Operational guide when the dispatcher cannot keep up with transient failures or upstream load. Source of truth: `design.md` §9.5.

## Primary signal

| Signal | Threshold | Detection |
|--------|-----------|-----------|
| `FAILED_RETRYABLE` depth | > 10,000 (default) | `alert_retryable_depth_v`, `evaluate_alerts().retryable_depth`, stats row `mmd_alert_retryable_depth` |

```sql
select message_dispatcher.message_dispatcher_evaluate_alerts();
-- inspect -> 'retryable_depth' -> 'breached', 'value', 'threshold'

select retryable_count
from message_dispatcher.alert_retryable_depth_v;
```

Triage which producers dominate the backlog:

```sql
select source_system, retryable_count
from message_dispatcher.alert_retryable_by_source_v
limit 20;
```

## Response playbook

### 1. Confirm it is backpressure (not a single poison batch)

- Check `alert_terminal_spike_v` — terminal rate should stay below 5% over 15m ingest cohort.
- Check `alert_janitor_churn_v` — high lease reclaims may indicate worker/DB stress.
- Sample recent `failure_code` on `FAILED_RETRYABLE` rows (provider outage vs quota vs lease).

### 2. Slow non-critical ingest by `source_system`

Design §9.5: reduce ingest rate for **non-critical** producers while retries drain.

| Action | Who | Notes |
|--------|-----|-------|
| Pause or throttle feature ingest | Owning team for `source_system` | Stop bulk/marketing sends first; keep transactional (`orbit`, auth) if possible |
| Canary allowlist | Platform | Restrict new ingests to known-good `source_system` values (see rollout tasks) |
| Lower checkout pressure | Platform | Set `message_dispatcher.checkout_batch_size` to 10–15 via `platform_constants` |

There is no per-`source_system` rate limit in MVP RPCs — coordination is at the **producer** (Orbit features, Edge callers, external jobs).

### 3. Reduce worker invocation rate (Edge 429 / platform throttle)

If Supabase/Edge returns **429** or worker logs show rate limiting:

- Decrease `message_dispatcher.max_parallel_workers` in `platform_constants` (default 5, minimum 1).
- Temporarily unschedule or slow `mmd_invoke_worker` in `cron.job`.

Do **not** set `max_parallel_workers` above 5 — risks Edge Function concurrency exhaustion.

### 4. Lower DB batch pressure

On statement timeouts or slow `checkout` / `promote_retries`:

- Lower `message_dispatcher.checkout_batch_size` (default 50).
- Ensure `mmd_reclaim_leases` runs before `mmd_promote_retries` (design §6.4).

### 5. Provider outage

When failure codes cluster on HTTP 5xx / timeout:

- Wait for provider recovery; `FAILED_RETRYABLE` will promote via `mmd_promote_retries`.
- Avoid new ingests for affected channel until depth falls below threshold.

## Recovery criteria

- `retryable_depth.breached = false` in `evaluate_alerts()` for two consecutive scrape intervals (~2 min).
- `mmd_retryable_failures` gauge trending down in `message_dispatcher_stats`.
- No sustained queue lag (`mmd_alert_queue_lag` breached).

## Related docs

- `operator-runbook-recovery-chain.md` — reclaim → promote → worker
- `operator-runbook-dead-letter.md` — if rows move to `FAILED_TERMINAL`
- `metrics-catalog.md` — alert mapping and dashboards
