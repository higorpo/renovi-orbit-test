# Matching — operational metrics and alerts

Runbook for provider matching / dispatch observability. Normative source: [`design.md`](./design.md) §10.3–§10.4.

Executable alert and dashboard SQL: [`supabase/scripts/matching-ops-alert-queries.sql`](../../supabase/scripts/matching-ops-alert-queries.sql).

**Access:** run ops queries with `service_role` or platform admin (`job_runs` is admin-readable via RLS). Do not expose these queries to client roles.

---

## Summary alerts (on-call)

| Alert | Condition | Severity | Primary signal |
|-------|-----------|----------|----------------|
| Matching cron error rate | `job_runs.error_count > 0` on **> 5%** of finished runs in **15 min** for `matching_process_service_request_dispatches` | **P2** | `job_runs` |
| Stuck dispatch lease | `lease_owner IS NOT NULL` AND `lease_expires_at < now() - 10 min` | **P2** | `service_request_dispatches` |
| Feed latency (optional) | p95 `list_provider_opportunities` **> 800 ms** | **P3** | Edge logs / Sentry spans |
| Consecutive cron failures | **> 10** consecutive error runs (same job) | **P2** | `job_runs` — see task 47 |

---

## Cron job

| `job_name` | Schedule (pg_cron) | Entrypoint |
|------------|-------------------|------------|
| `matching_process_service_request_dispatches` | `*/2 * * * *` | `cron_process_service_request_dispatches()` |

Each invocation records a row in `public.job_runs` with phase metadata:

- `metadata.phase1_expired_count`
- `metadata.phase2a_processed` / `phase2a_errors`
- `metadata.phase2b_processed` / `phase2b_errors`

`lease_owner` on dispatch rows embeds `matching_cron:<job_run_id>` for correlation.

---

## Recommended dashboards

### 1. Active dispatches by status

Gauge of non-terminal workload. Sudden spikes in `DISPATCH_STOPPED` / `DISPATCH_PAUSED` may indicate gate pressure or chat-activity saturation.

```sql
select status, count(*)::bigint as dispatch_count
from public.service_request_dispatches
group by status
order by dispatch_count desc;
```

### 2. Batch open latency

Median/p95 delay between due `next_batch_at` and `batch_opened` dispatch event (audit only — approximate when events are missing).

See **§ batch open latency** in `matching-ops-alert-queries.sql`.

### 3. Pool exhaustion rate

Daily count of dispatches that exhausted the progressive pool (`pool_exhausted` event → `DISPATCH_FALLBACK_OPEN_MARKET`).

```sql
select date_trunc('day', created_at) as day, count(*)::bigint as pool_exhausted_count
from public.service_request_dispatch_events
where event_type = 'pool_exhausted'
  and created_at > now() - interval '30 days'
group by 1
order by 1 desc;
```

### 4. MMD `matching.new_opportunity` delivery ratio

24h ratio of terminal success vs attempts for batch notification fan-out.

See **§ MMD delivery ratio** in `matching-ops-alert-queries.sql`.

### 5. Cron phase-1 lifecycle sweep

Expired dispatch count per run (from `job_runs.metadata` or `dispatch_expired` events).

```sql
select
  started_at,
  (metadata->>'phase1_expired_count')::int as phase1_expired,
  processed_count,
  error_count,
  duration_ms
from public.job_runs
where job_name = 'matching_process_service_request_dispatches'
  and started_at > now() - interval '24 hours'
order by started_at desc
limit 100;
```

---

## Minimum alert queries (implement in Grafana / Supabase scheduled SQL / external monitor)

### A. Cron error rate (15 min window)

**Fire when:** `error_rate > 0.05` AND `total_runs >= 3` (avoid noise on sparse envs).

```sql
-- matching_alert_cron_error_rate_15m
select
  count(*) filter (where error_count > 0) as error_runs,
  count(*) as total_runs,
  round(
    count(*) filter (where error_count > 0)::numeric / nullif(count(*), 0),
    4
  ) as error_rate
from public.job_runs
where job_name = 'matching_process_service_request_dispatches'
  and finished_at is not null
  and started_at > now() - interval '15 minutes';
```

### B. Stuck dispatch leases

**Fire when:** `stuck_lease_count > 0`.

Normal recovery is via `matching.dispatch_lease_seconds` TTL (≤ ~6 min worst case with 2 min cron cadence). Leases older than **10 min** indicate a pathological worker crash or bug.

```sql
-- matching_alert_stuck_leases
select count(*)::bigint as stuck_lease_count
from public.service_request_dispatches d
where d.lease_owner is not null
  and d.lease_expires_at is not null
  and d.lease_expires_at < now() - interval '10 minutes';
```

Detail rows for triage:

```sql
select
  d.id,
  d.service_request_id,
  d.status,
  d.lease_owner,
  d.lease_expires_at,
  d.next_batch_at,
  d.updated_at
from public.service_request_dispatches d
where d.lease_owner is not null
  and d.lease_expires_at < now() - interval '10 minutes'
order by d.lease_expires_at asc
limit 50;
```

---

## Sentry / client monitoring

| Surface | Wiring |
|---------|--------|
| Edge `list-provider-opportunities` | Existing Sentry Edge spans (`list-provider-opportunities.handle`); alert on p95 latency or 5xx rate in Sentry Performance |
| Provider jobs UI | Sentry feature tag `provider-jobs` on client errors (sort mode, cursor present) |
| Postgres cron | **No Sentry hook today** — use `job_runs` SQL alerts above; optional Postgres `RAISE LOG` lines already emitted on phase-2 errors |

---

## Incident response (short)

1. **Confirm signal** — match alert timestamp to latest `job_runs` row for `matching_process_service_request_dispatches`.
2. **Stuck lease** — inspect rows from detail query; check `service_request_dispatch_events` for the affected `service_request_id`. Manual release: `select matching_release_dispatch_lease('<dispatch_id>');` (service_role). See task 46 runbook for bulk stale-lease procedure.
3. **Cron errors** — `select * from job_runs where job_name = 'matching_process_service_request_dispatches' and error_count > 0 order by started_at desc limit 20;` Review `metadata->>'error'` and Postgres logs for `matching_cron_phase2a_error` / `matching_cron_phase2b_error`.
4. **Dispatch audit trail** — `select * from service_request_dispatch_events where service_request_id = '<uuid>' order by created_at desc limit 50;`
5. **Notification gap** — check MMD delivery ratio query; inspect `message_dispatcher.message_dispatches` for `template_key = 'matching.new_opportunity'`.

---

## Related tasks

| Task | Topic |
|------|--------|
| 46 | Stuck lease reconciliation SQL + weekly runbook |
| 47 | Consecutive `job_runs` error escalation |
| 13 | Cron worker implementation |

---

## Stuck lease reconciliation (task 46)

Dispatch leases normally self-heal via `matching.dispatch_lease_seconds` TTL and the next cron tick (~2 min cadence; worst case ~6 min). When the **stuck lease alert** (§ minimum alert B) fires, use this procedure.

### Weekly audit (optional schedule)

Run every **Monday 09:00 UTC** (or wire to the same monitor as alert B with a higher threshold). Zero rows is healthy.

```sql
-- matching_weekly_stale_lease_audit
select
  d.id as dispatch_id,
  d.service_request_id,
  d.status,
  d.lease_owner,
  d.lease_expires_at,
  d.next_batch_at
from public.service_request_dispatches d
where d.lease_owner is not null
  and (
    d.lease_expires_at is null
    or d.lease_expires_at < now() - interval '10 minutes'
  )
order by d.lease_expires_at nulls first
limit 100;
```

### Manual single-row release

When triaging one dispatch (no active worker on that row):

```sql
select public.matching_release_dispatch_lease('<dispatch_id>'::uuid);
```

Verify `lease_owner` and `lease_expires_at` are NULL. The dispatch becomes eligible on the next cron tick if `next_batch_at <= now()` and status is `DISPATCH_PENDING` or `DISPATCH_ACTIVE`.

### Bulk janitor RPC

`matching_force_release_stale_leases` clears stale leases in batches (**service_role only**). Default: leases expired more than **10 minutes** ago, up to **500** rows per call.

```sql
select public.matching_force_release_stale_leases();
-- => {"released_count": N, "cutoff_at": "...", "batch_limit": 500}
```

Custom cutoff / batch size:

```sql
select public.matching_force_release_stale_leases(interval '10 minutes', 100);
```

**When to use:** pathological worker crash left `lease_owner` set after TTL; alert B sustained >15 min; weekly audit returns rows. **Do not** run during active incident debugging until confirming no live cron worker holds the lease (check `job_runs` for in-flight runs).

### Post-repair verification

1. Re-run stuck-lease alert query — expect `stuck_lease_count = 0`.
2. Confirm affected dispatches progress: `select status, next_batch_at, updated_at from service_request_dispatches where id = '<dispatch_id>';`
3. Inspect audit trail: `select event_type, created_at, payload from service_request_dispatch_events where dispatch_id = '<dispatch_id>' order by created_at desc limit 20;`

---

## Consecutive cron failure escalation (task 47)

**Fire when:** `matching_ops_consecutive_cron_errors(10)->>'alert' = 'true'` — more than **10 consecutive** finished `job_runs` rows with `error_count > 0` for `matching_process_service_request_dispatches`.

```sql
select public.matching_ops_consecutive_cron_errors(10, 100);
-- consecutive_error_runs, threshold, alert, suspect_service_request_ids
```

Phase-2 per-dispatch failures are recorded in `job_runs.metadata.error_dispatches` (dispatch_id, service_request_id, phase, sqlstate, message). The helper aggregates `suspect_service_request_ids` from those entries across the consecutive error window.

### Ops playbook — poison dispatch investigation

1. **Confirm escalation**
   ```sql
   select id, started_at, error_count, metadata
   from public.job_runs
   where job_name = 'matching_process_service_request_dispatches'
   order by started_at desc
   limit 20;
   ```

2. **Identify suspect service requests** — from `matching_ops_consecutive_cron_errors` or:
   ```sql
   select distinct entry->>'service_request_id' as service_request_id,
          count(*) as error_mentions
   from public.job_runs jr
   cross join lateral jsonb_array_elements(coalesce(jr.metadata->'error_dispatches', '[]'::jsonb)) entry
   where jr.job_name = 'matching_process_service_request_dispatches'
     and jr.error_count > 0
     and jr.started_at > now() - interval '2 hours'
   group by 1
   order by error_mentions desc;
   ```

3. **Inspect dispatch audit trail** for each suspect SR:
   ```sql
   select event_type, created_at, payload
   from public.service_request_dispatch_events
   where service_request_id = '<uuid>'
   order by created_at desc
   limit 50;
   ```

4. **Manual gate re-evaluation** (service_role) after fixing upstream data issue:
   ```sql
   select public.evaluate_service_request_dispatch_gates('<service_request_id>'::uuid);
   ```

5. **Release stale lease** if dispatch row is blocked:
   ```sql
   select public.matching_release_dispatch_lease('<dispatch_id>'::uuid);
   -- or bulk: select public.matching_force_release_stale_leases();
   ```

6. **Pause poison row** (last resort) — set `next_batch_at = now() + interval '7 days'` and investigate offline, or transition dispatch to `DISPATCH_CANCELLED` via product cancel flow.

7. **Verify recovery** — wait for 2+ successful cron ticks (`error_count = 0`); re-run consecutive-errors helper; alert should clear.

---

## MMD delivery failure — visibility without push (task 48, Req 6.4)

When batch open succeeds, **feed visibility is already persisted** in `service_request_provider_visibility` (`source = 'batch'`). Message Dispatcher (MMD) notifications are a **best-effort channel** — push/e-mail failure or quota exhaustion **must not** roll back visibility or block dispatch progression (design §8.1, Req 6.4 / #12).

### Expected behavior (option A)

| Scenario | Visibility | Push | Email | Provider discovery |
|----------|------------|------|-------|-------------------|
| Batch opens normally | Granted | Enqueued if quota/cooldown OK | Enqueued if quota OK | Push, email, or feed |
| Daily **push quota exhausted** | **Still granted** | Terminal skip — **no next-day retry** for that dispatch | Enqueued if email quota permits | Email or in-app feed |
| Push delivery fails (FCM) | Granted | MMD retry/backoff then terminal | Unaffected | Feed |
| No push targets / invalid device | Granted | Terminal (`no_push_targets`) | Email may still send | Feed |
| MMD ingest fails **during batch txn** | **Not granted** (whole batch rolls back) | N/A | N/A | Retry on next cron tick |

Idempotency key format (one per channel):

```text
dispatch:{service_request_id}:batch:{batch_number}:provider:{provider_id}:{channel}
```

Ingest uses `mmd_idempotency_uuid(idempotency_text)` — **re-ingesting the same key is a no-op**.

### Ops SHALL NOT

- Manually re-enqueue `matching.new_opportunity` for the **same** idempotency key (duplicate protection exists for a reason; provider already has feed visibility).
- Delete visibility rows to “force a resend” — use product dismiss/feed flows instead.
- Set `bypass_limits = true` on matching batch notifications (always `false` at ingest).

### Triage queries

**Confirm visibility exists (provider should see feed regardless of push):**

```sql
select v.service_request_id, v.provider_id, v.source, v.granted_at, v.dismissed_at
from public.service_request_provider_visibility v
where v.service_request_id = '<service_request_id>'::uuid
  and v.provider_id = '<provider_id>'::uuid
  and v.source = 'batch';
```

**Inspect MMD dispatches for a batch exposure:**

```sql
select
  md.id,
  md.channel,
  md.status,
  md.template_key,
  md.created_at,
  md.updated_at,
  md.metadata->>'idempotency_key' as idempotency_key
from message_dispatcher.message_dispatches md
where md.template_key = 'matching.new_opportunity'
  and md.metadata->>'idempotency_key' like format(
    'dispatch:%s:batch:%s:provider:%s:%%',
    '<service_request_id>',
    '<batch_number>',
    '<provider_id>'
  )
order by md.created_at desc;
```

**24h matching.new_opportunity outcomes** (dashboard panel — also in `matching-ops-alert-queries.sql`):

```sql
select
  md.channel,
  md.status,
  count(*)::bigint as dispatch_count
from message_dispatcher.message_dispatches md
where md.template_key = 'matching.new_opportunity'
  and md.created_at > now() - interval '24 hours'
group by md.channel, md.status
order by md.channel, dispatch_count desc;
```

### When provider reports “didn't get push”

1. Confirm **batch visibility** row exists (query above) — if missing, investigate cron/batch open, not MMD.
2. Check MMD row for push channel — status `DELIVERED` vs `FAILED_TERMINAL` / quota skip metadata.
3. If push quota exhausted: **expected** — provider discovers via feed or email; document for support; do **not** re-enqueue push.
4. If email channel `DELIVERED` but push failed: expected partial delivery per Req 6.4.
5. If both channels terminal and visibility exists: provider uses **Jobs feed** (`list_provider_opportunities`); no ops action required unless systemic MMD outage.

### When to escalate

- Spike in `FAILED_TERMINAL` or ingest errors for `matching.new_opportunity` across many providers → MMD platform incident (see `docs/message-dispatcher/` runbooks).
- Visibility missing but `batch_opened` event exists → dispatch/cron data inconsistency; inspect `service_request_dispatch_batch_providers` and visibility UNIQUE constraint violations in logs.

---

## Production readiness checklist

After **M12** (feed RPC + Edge) and **M14** (CNS dispatch gates) are deployed on an environment, validate before treating progressive matching as GA ([`qa/staging-full-batch-path-checklist.md`](./qa/staging-full-batch-path-checklist.md)).

### Pre-GA checklist

- [ ] Matching migrations applied through M15 on target environment (legacy `match_provider_jobs` removed).
- [ ] `matching_process_service_request_dispatches` cron active; recent `job_runs` with `error_count = 0`.
- [ ] `list-provider-opportunities` Edge deployed; smoke test returns `{ items, next_cursor, has_more }`.
- [ ] Staging full batch path signed off (Task 58).
- [ ] MMD worker enabled if push/email notifications required in that environment.
- [ ] On-call aware of dispatch table growth and cron dashboards ([§ Summary alerts](#summary-alerts-on-call)).

### Post-deploy monitoring (first 24–48 h)

| Signal | Query / action |
|--------|----------------|
| Dispatch row growth | [§ Active dispatches by status](#1-active-dispatches-by-status) |
| Cron health | [§ Cron error rate (15 min)](#a-cron-error-rate-15-min-window) |
| Batch open latency | `matching-ops-alert-queries.sql` § batch open latency |
| MMD delivery ratio | `matching-ops-alert-queries.sql` § MMD delivery ratio |
| Feed errors | Edge/Sentry `list-provider-opportunities` 4xx/5xx rate |

**Incident trigger examples:** cron error rate > 5% sustained, stuck leases accumulating, feed p95 > 800 ms with user-visible failures — pause cron or investigate before continuing rollout.
