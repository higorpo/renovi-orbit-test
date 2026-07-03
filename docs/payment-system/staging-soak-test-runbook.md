# Staging soak test — 72h cron + webhook + reconcile loop (Task 128)

Operational validation on **staging** before Phase E (live charge cron) or production money movement. Run after Tasks 100/102 deploy artifacts are in place.

## Purpose

Prove the async payment loop is stable for **72 consecutive hours**:

1. **Cron workers** — pg_cron → `payment_cron_*()` → Edge Functions complete without fatal errors
2. **Webhook path** — NetCred events ingest, process (inline or retry cron), no unbounded `DEAD_LETTER` growth
3. **Reconcile path** — stale schedules drain via `reconcile-netcred-payments` without duplicate commits

## Prerequisites

- [ ] Staging Supabase project with migrations through `20260801780000` (or current HEAD)
- [ ] Seven payment Edge Functions deployed to staging
- [ ] Vault + Edge secrets per [`vault-secrets-runbook.md`](./vault-secrets-runbook.md)
- [ ] `ORBIT_CRON_SECRET` configured (pg_cron → EF auth)
- [ ] NetCred **sandbox** credentials (not production)
- [ ] NetCred webhook URL points to staging `netcred-webhook`
- [ ] All eight payment crons **active** (see [`production-rollout-checklist.md`](./production-rollout-checklist.md))
- [ ] Sentry staging DSN receiving payment events (Task 82)
- [ ] At least **3 test contracted services** seeded with different charge windows:
  - T-2 schedule (charge in ~48h)
  - Near-term schedule (`charge_scheduled_at` within next cron window)
  - `IN_ANALYSIS` or `FAILED` schedule for reconcile/webhook coverage

Optional pre-soak: [`load-test-claim-batch.md`](./load-test-claim-batch.md) for claim contention baseline.

## Scope — three loops under test

| Loop | Cron / EF | Validates |
|------|-----------|-----------|
| **Charge** | `schedule-netcred-charges` every 6h | `payment_claim_charge_batch` → EF → `payment_commit_charge_outcome` |
| **Webhook** | `process-webhook-retry` every 5m | HMAC ingest, inline handler, retry queue drain |
| **Reconcile** | `reconcile-netcred-payments` every 30m | `payment_claim_stale_schedules_for_reconciliation` → `getTransaction` → commit |

Supporting crons (`payment_recover_orphaned_schedules`, `notify-upcoming-charges`, etc.) should run without `fatal_error` but are not the primary soak focus.

## 72h procedure

### T+0 — Baseline snapshot

Record start timestamp (UTC). Capture baselines:

```sql
-- Cron health
select jobname, active, schedule from cron.job
where jobname like '%payment%' or jobname like '%netcred%' or jobname like '%webhook%'
order by jobname;

-- Schedule state distribution
select state, count(*) from public.payment_schedules group by 1 order by 1;

-- Webhook backlog
select state, count(*) from public.payment_webhook_events group by 1 order by 1;

-- Recent job_runs (should be empty of fatal_error)
select job_name, started_at, finished_at, error_count, metadata->>'fatal_error' as fatal_error
from public.job_runs
where job_name like '%payment%' or job_name like '%netcred%' or job_name like '%webhook%'
order by started_at desc
limit 30;
```

Trigger at least one **sandbox charge attempt** (accept proposal → wait for charge cron or manual `schedule-netcred-charges` invoke). Confirm webhook delivery in NetCred dashboard.

### T+0 → T+24h — Day 1 monitoring

Every **6 hours**, run the monitoring block below. On-call checks Sentry for new `payment.*` issues.

**Day 1 exit criteria (partial):**

- [ ] `schedule-netcred-charges` `job_runs` rows: `fatal_error` is null on all runs
- [ ] At least one `payment_schedules` transition observed (`SCHEDULED` → `PROCESSING` → terminal or retry)
- [ ] `payment_webhook_events` with `state = 'PROCESSED'` increased since T+0
- [ ] Zero rows in `DEAD_LETTER` **or** each dead letter has operator ticket + reset plan

### T+24h → T+48h — Day 2 monitoring

Continue 6h monitoring. Inject **controlled failure** once (optional but recommended):

| Injection | Expected recovery |
|-----------|-------------------|
| Duplicate webhook POST (same `gateway_event_id`) | Second insert rejected; schedule state unchanged |
| Stale `PROCESSING` + expired `locked_until` | `payment_recover_orphaned_schedules` recovers within 30m |
| Simulated gateway timeout (sandbox card) | Reconcile cron commits or schedules retry; no duplicate `PAID` |

**Day 2 exit criteria:**

- [ ] No duplicate `PAID` on same `contracted_service_id`
- [ ] `payment_attempts` row count matches expected attempts (append-only; no gaps from silent failures)
- [ ] `reconcile-netcred-payments` `job_runs.error_count` stable (not monotonically increasing)

### T+48h → T+72h — Day 3 monitoring

Continue 6h monitoring. Validate notification side-effects are **decoupled** (MMD failures must not roll back charge TX):

```sql
-- Charge succeeded without requiring notification success
select ps.id, ps.state, ps.paid_at,
  (select count(*) from public.payment_audit_log pal
   where pal.schedule_id = ps.id and pal.event_type = 'CHARGE_PAID') as audit_rows
from public.payment_schedules ps
where ps.state = 'PAID'
  and ps.updated_at >= now() - interval '72 hours';
```

**Day 3 exit criteria (soak pass):**

- [ ] 72h elapsed with **zero** `job_runs.metadata.fatal_error` on charge, webhook-retry, reconcile crons
- [ ] `DEAD_LETTER` count ≤ baseline + 1 (documented and reset)
- [ ] No `payment_schedules` stuck in `PROCESSING` with `locked_until < now() - 1 hour`
- [ ] Webhook retry queue depth returns to near-zero within 15m after burst test
- [ ] Reconcile loop processed at least one stale schedule (or documented "none eligible" with SQL proof)

## Monitoring block (repeat every 6h)

```sql
-- 1. Cron fatals (last 12h)
select job_name, count(*) as runs,
  count(*) filter (where metadata->>'fatal_error' is not null) as fatal_runs,
  max(error_count) as max_errors
from public.job_runs
where started_at >= now() - interval '12 hours'
  and (job_name like '%payment%' or job_name like '%netcred%' or job_name like '%webhook%')
group by 1
order by fatal_runs desc, 1;

-- 2. Stuck leases
select id, state, locked_until, automatic_attempt_count, updated_at
from public.payment_schedules
where state = 'PROCESSING'
  and locked_until < now() - interval '30 minutes';

-- 3. Webhook backlog
select state, count(*), max(updated_at) as latest
from public.payment_webhook_events
where created_at >= now() - interval '72 hours'
group by 1
order by 1;

-- 4. Reconcile candidates (informational)
select count(*) as stale_candidates
from public.payment_schedules ps
where ps.state in ('PROCESSING', 'IN_ANALYSIS', 'FAILED')
  and ps.locked_until is null
  and ps.updated_at < now() - interval '2 hours';
```

## Pass / fail gate (Phase E)

| Result | Action |
|--------|--------|
| **PASS** | Proceed to Phase E per [`production-rollout-checklist.md`](./production-rollout-checklist.md); document sign-off below |
| **FAIL** | Halt Phase E; triage via [`operator-dead-letter-runbook.md`](./operator-dead-letter-runbook.md) and [`payment-rollback-runbook.md`](./payment-rollback-runbook.md); fix + restart 72h soak |

## Sign-off template

```
Staging soak test — Task 128
Environment: staging / <project-ref>
Start (UTC): ___________
End (UTC):   ___________
Result: PASS / FAIL

Loops validated:
  [ ] Charge cron (schedule-netcred-charges)
  [ ] Webhook (netcred-webhook + process-webhook-retry)
  [ ] Reconcile (reconcile-netcred-payments)

Fatal job_runs during soak: ___
DEAD_LETTER delta: ___
Stuck PROCESSING at T+72h: ___

Approver: ___________
```

## Related docs

- [`phased-cron-enablement-plan.md`](./phased-cron-enablement-plan.md) — deploy guide
- [`production-rollout-checklist.md`](./production-rollout-checklist.md) — post-soak production steps
- [`payment-rollback-runbook.md`](./payment-rollback-runbook.md) — disable crons on failure
- [`operator-dead-letter-runbook.md`](./operator-dead-letter-runbook.md) — webhook dead-letter recovery
