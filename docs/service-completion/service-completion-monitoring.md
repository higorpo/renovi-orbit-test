# Service completion monitoring — metrics & alerts (Task 56)

Ops health pack for enrichment + completion crons. Normative: [design.md §10.4–10.6](./design.md).

## Quick health check

```sql
select public.service_completion_ops_metrics(24);
```

Returns JSON with:

| Field | Meaning |
|-------|---------|
| `enrichment_age.age_seconds_p50` / `p95` | Age of due PENDING enrichments (ops_attention excluded) |
| `ai_vs_fallback` | READY materializations in lookback: AI vs `fallback_template` |
| `auto_vs_manual_complete` | COMPLETED `completed_by=system` vs `client` |
| `lease_reclaim_count_24h_window` | `RECLAIM` enrichment events in lookback |
| `ops_attention_open_count` | Open ops-attention holds (must be 0 in steady state) |
| `orphan_deletes` | Sum of janitor `transitioned_count` when Task 58/59 ships |
| `latest_job_runs` | Latest row per tracked cron |

**service_role only.**

## Evaluate alerts (dry-run)

```sql
select public.service_completion_evaluate_sentry_alerts();
-- [] when healthy; otherwise alerts[] for orbit-emit-sentry-alerts
```

Cron (every 5m): `service_completion_cron_emit_sentry_alerts` → `orbit_post_sentry_alerts`.

## Tracked cron jobs

| `job_runs.job_name` | Wrapper | Schedule (UTC) |
|---------------------|---------|----------------|
| `enrichment_cron_sweep` | `enrichment_cron_sweep()` | Task 28 schedule |
| `service_completion_cron_auto_complete_executed` | `service_completion_cron_auto_complete_executed()` | `45 9,15,21,3 * * *` |
| `service_completion_cron_orphan_upload_janitor` | `service_completion_cron_orphan_upload_janitor()` → SQL `service_completion_janitor_orphan_uploads` | `20 * * * *` |
| `service_completion_emit_sentry_alerts` | `service_completion_cron_emit_sentry_alerts()` | `*/5 * * * *` |

## Alert thresholds

| Alert `code` | Condition | Severity | Action |
|--------------|-----------|----------|--------|
| `OPS_ATTENTION` | Any enrichment with `ops_attention_at IS NOT NULL` | **CRITICAL** | Inspect reason (missing templates / cascade); clear via ops RPC after fix |
| `MISSING_TEMPLATES` | No active global checklist template | **CRITICAL** | Seed/activate global `completion_checklist_templates` |
| `PENDING_AGE_WARNING` | Due PENDING age ≥ `enrichment_pending_age_warning_minutes` (default 15) | **WARNING** | Check Edge wake, LLM quota, claim lease |
| `PENDING_AGE_CRITICAL` | Due PENDING age ≥ `enrichment_pending_age_critical_minutes` (default 60) | **CRITICAL** | Page; verify cron sweep + worker |
| `AUTO_COMPLETE_JOB_ERRORS` | Last N auto-complete runs all have `error_count > 0` (N=`service_completion_auto_complete_error_consecutive`, default 2) | **WARNING** | Inspect `job_runs.metadata.error_samples` |

Platform constants (tunable):

- `enrichment_pending_age_warning_minutes`
- `enrichment_pending_age_critical_minutes`
- `service_completion_auto_complete_error_consecutive`

## Sentry routing

Generic `level` + `message` contract via `orbit-emit-sentry-alerts` (same path as FAR recapture fatals). Tags include `code` when present.

## Manual query pack

### 1. Open ops_attention

```sql
select id, service_request_id, ops_attention_reason, ops_attention_at, attempt_count
from public.service_request_enrichments
where ops_attention_at is not null
order by ops_attention_at;
```

### 2. Due PENDING age

```sql
select id, service_request_id, created_at, next_attempt_at,
  round(extract(epoch from (now() - created_at)) / 60.0, 1) as age_minutes
from public.service_request_enrichments
where status = 'PENDING'
  and ops_attention_at is null
  and (next_attempt_at is null or next_attempt_at <= now())
order by created_at
limit 50;
```

### 3. Auto-complete recent errors

```sql
select started_at, finished_at, error_count, metadata
from public.job_runs
where job_name = 'service_completion_cron_auto_complete_executed'
order by started_at desc
limit 10;
```

### 4. AI vs fallback (7d)

```sql
select source, count(*)
from public.service_request_enrichments
where status = 'READY'
  and materialized_at > now() - interval '7 days'
group by source;
```

## Runbook pointers

- Clear ops hold: `enrichment_clear_ops_attention` (Task 22) after fixing templates/cascade.
- Enrichment worker: Edge `generate-completion-checklist`; safety net `enrichment_cron_sweep`.
- Completion writers: ADR-0004 `service_completion_*` only.
- Structured logs / redaction: Task 55 (`service-completion-logger`).

## Recovery runbook (design §8 / Task 59)

Automated coverage: `supabase/tests/service_completion/failure_matrix_recovery_test.sql` + Deno `processClaimedRow` §8.1 cases.

| Failure | Expected recovery | Verify |
|---------|-------------------|--------|
| Lease expired mid-LLM | `enrichment_reclaim_expired_leases` → PENDING + gen++; stale finalize → `STALE_LEASE_OR_STATE` | Matrix pgTAP + Task 23 |
| READY without dispatch | `enrichment_repair_ready_without_dispatch` bootstraps matching; **no** schema rewrite | Matrix pgTAP + Task 24 |
| Edge wake (pg_net) fail | PENDING stays durable; `enrichment_cron_sweep` recounts due + re-wakes | Matrix pgTAP (`due_pending_count`) |
| Invalid AI / validation | Retry while attempts remain; then template fallback | Deno §8.1 validation tests |
| Template missing all levels | `ops_attention` hold; claim skips; CRITICAL alert (Task 56) | Matrix + mark_ops + metrics alerts |
| Worker crash after READY | Finalize CAS idempotent (`idempotent: true`) | Matrix pgTAP |
| Orphan uploads | Claim (57) + Edge delete (58); missing object = success | Janitor Deno/pgTAP |

**Ops order:** (1) check `service_completion_ops_metrics` / open `ops_attention`, (2) run/inspect `enrichment_cron_sweep` `job_runs`, (3) clear ops after seeding templates, (4) confirm PENDING age alerts clear.
