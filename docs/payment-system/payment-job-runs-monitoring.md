# Payment cron monitoring — `job_runs` health pack (Task 130)

Post-rollout ops queries for payment pg_cron wrappers. Normative source: design.md §10.1; `job_runs` telemetry (tasks 51–58, 82).

## Quick health check

```sql
select public.payment_ops_job_health(24, 30);
```

Returns JSON with:

| Field | Meaning |
|-------|---------|
| `summary.healthy` | `true` when no stale or fatal runs in lookback |
| `summary.stale_run_count` | `finished_at IS NULL` longer than `stale_minutes` |
| `summary.error_run_count` | Runs with `error_count > 0` |
| `summary.fatal_run_count` | Runs with `metadata.fatal_error` set |
| `jobs[]` | Latest run per tracked payment cron |
| `stale_runs` / `error_runs` / `fatal_runs` | Detail arrays for dashboard drill-down |

**service_role only** — use Supabase SQL editor (postgres) or RPC from internal tooling.

## Tracked cron jobs

| `job_runs.job_name` | Wrapper RPC | Schedule (UTC) |
|---------------------|-------------|----------------|
| `payment_recover_orphaned_schedules` | `payment_cron_recover_orphaned_schedules()` | `*/30 * * * *` |
| `process-webhook-retry` | `payment_cron_process_webhook_retry()` | `*/5 * * * *` |
| `reconcile-netcred-payments` | `payment_cron_reconcile_netcred_payments()` | `*/30 * * * *` |
| `reconcile-inanalysis-auto-cancel-voids` | `payment_cron_reconcile_inanalysis_auto_cancel_voids()` | `*/30 * * * *` |
| `notify-upcoming-charges` | `payment_cron_notify_upcoming_charges()` | `30 9,15,21,3 * * *` |
| `auto-cancel-unpaid-services` | `payment_cron_auto_cancel_unpaid_services()` | `15 9,15,21,3 * * *` |
| `schedule-netcred-charges` | `payment_cron_schedule_netcred_charges()` | `0 9,15,21,3 * * *` |
| `detect-netcred-onboarding` | `payment_cron_detect_netcred_onboarding()` | `0 10 * * *` |
| `auto-complete-executed-services` | `payment_cron_auto_complete_executed_services()` | `45 9,15,21,3 * * *` |

## Alert thresholds (on-call)

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Stale cron run | `finished_at IS NULL` and `started_at < now() - 30m` | **P2** | Check pg_cron worker, long TX, or `job_run_abort_latest` failure |
| Row errors | `error_count > 0` on latest run | **P2** | Inspect `metadata` (batch errors, webhook queue depth) |
| Fatal abort | `metadata.fatal_error` present | **P1** | Wrapper exception before `job_run_finish`; see rollback runbook |
| Missing recent run | No `job_runs` row in 2× expected interval | **P2** | Verify `cron.job.active = true` |

Pair with Sentry alerts from Task 82 (`payment-emit-sentry-alerts` EF) for `tokenAuth` CRITICAL and `FAILED_PERMANENT` WARNING events.

## Manual query pack

### 1. Stale runs (`finished_at IS NULL`)

```sql
select job_name, id, started_at,
  round(extract(epoch from (now() - started_at)) / 60.0, 1) as minutes_running
from public.job_runs
where job_name in (
  'payment_recover_orphaned_schedules',
  'process-webhook-retry',
  'reconcile-netcred-payments',
  'reconcile-inanalysis-auto-cancel-voids',
  'notify-upcoming-charges',
  'auto-cancel-unpaid-services',
  'schedule-netcred-charges',
  'detect-netcred-onboarding',
  'auto-complete-executed-services'
)
  and finished_at is null
  and started_at < now() - interval '30 minutes'
order by started_at;
```

### 2. Runs with errors (`error_count > 0`)

```sql
select job_name, started_at, finished_at, error_count, processed_count, metadata
from public.job_runs
where job_name like '%netcred%'
   or job_name like '%webhook%'
   or job_name like '%payment%'
   or job_name in (
     'process-webhook-retry',
     'notify-upcoming-charges',
     'auto-cancel-unpaid-services',
     'schedule-netcred-charges',
     'auto-complete-executed-services',
     'reconcile-inanalysis-auto-cancel-voids'
   )
  and error_count > 0
  and started_at > now() - interval '24 hours'
order by started_at desc
limit 50;
```

### 3. Fatal errors (`metadata.fatal_error`)

```sql
select job_name, started_at, finished_at,
  metadata->>'fatal_error' as fatal_error,
  metadata
from public.job_runs
where nullif(metadata->>'fatal_error', '') is not null
  and started_at > now() - interval '7 days'
order by started_at desc
limit 20;
```

### 4. Latest run per job (dashboard tile)

```sql
select distinct on (job_name)
  job_name,
  started_at,
  finished_at,
  duration_ms,
  processed_count,
  error_count,
  metadata->>'fatal_error' as fatal_error
from public.job_runs
where job_name in (
  'payment_recover_orphaned_schedules',
  'process-webhook-retry',
  'reconcile-netcred-payments',
  'reconcile-inanalysis-auto-cancel-voids',
  'notify-upcoming-charges',
  'auto-cancel-unpaid-services',
  'schedule-netcred-charges',
  'detect-netcred-onboarding',
  'auto-complete-executed-services'
)
order by job_name, started_at desc;
```

### 5. Cron registration sanity

```sql
select jobname, schedule, active, command
from cron.job
where jobname in (
  'payment_recover_orphaned_schedules',
  'process-webhook-retry',
  'reconcile-netcred-payments',
  'reconcile-inanalysis-auto-cancel-voids',
  'notify-upcoming-charges',
  'auto-cancel-unpaid-services',
  'schedule-netcred-charges',
  'detect-netcred-onboarding',
  'auto-complete-executed-services'
)
order by jobname;
```

## Grafana / Metabase notes

- **Panel 1:** `payment_ops_job_health()->'summary'->>'healthy'` (boolean stat)
- **Panel 2:** time series of `error_count` from latest runs (poll query 4 every 5m)
- **Panel 3:** table from `fatal_runs` array when `summary.fatal_run_count > 0`
- **Panel 4:** alert when `summary.stale_run_count > 0` for > 15 minutes

## Related

- [`staging-soak-test-runbook.md`](./staging-soak-test-runbook.md) — 72h validation before rollout
- [`production-rollout-checklist.md`](./production-rollout-checklist.md) — cron inventory
- [`payment-rollback-runbook.md`](./payment-rollback-runbook.md) — disable crons on incident
- [`operator-dead-letter-runbook.md`](./operator-dead-letter-runbook.md) — webhook dead letters
