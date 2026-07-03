# Payment rollback runbook (Task 103)

Operational rollback when payment crons or Edge Functions misbehave. DB migrations are **forward-only** — rollback = disable crons + redeploy previous EF versions. Design reference: `design.md` §8.3; `IMPLEMENTATION_BASELINE.md` §1.2.

## Severity levels

| Level | Trigger | Action |
|-------|---------|--------|
| **P1 — stop money** | Wrong charges, duplicate debits, runaway batch | Disable `schedule-netcred-charges` immediately |
| **P2 — stop async** | Webhook storm, reconcile loop errors | Disable webhook retry + reconcile crons |
| **P3 — partial** | Single job unhealthy | Disable that `cron.job` only |

## Step 1 — Disable pg_cron jobs

Prefer toggling `active = false` (preserves schedule for re-enable):

```sql
-- Stop all payment crons
update cron.job
set active = false
where jobname in (
  'payment_recover_orphaned_schedules',
  'process-webhook-retry',
  'reconcile-netcred-payments',
  'notify-upcoming-charges',
  'auto-cancel-unpaid-services',
  'schedule-netcred-charges',
  'detect-netcred-onboarding',
  'auto-complete-executed-services'
);
```

**P1 only (charge cron):**

```sql
update cron.job set active = false where jobname = 'schedule-netcred-charges';
```

Verify:

```sql
select jobname, active from cron.job
where jobname like '%netcred%' or jobname like '%webhook%' or jobname like '%payment%' or jobname like 'auto-%' or jobname like 'notify-%' or jobname like 'schedule-%' or jobname like 'detect-%' or jobname like 'reconcile-%' or jobname like 'process-%';
```

## Step 2 — Drain in-flight work

### Orphan PROCESSING leases

After disabling charge cron, stale `PROCESSING` rows may remain:

```sql
-- Inspect orphans (locked_until expired)
select id, contracted_service_id, state, locked_until, automatic_attempt_count
from public.payment_schedules
where state = 'PROCESSING'
  and (locked_until is null or locked_until < now());
```

Run janitor once manually (if safe):

```sql
select public.payment_cron_recover_orphaned_schedules();
```

Or wait for janitor after re-enabling only the janitor cron in isolation.

### Webhook queue

```sql
select state, count(*) from public.payment_webhook_processing_queue group by 1;
select state, count(*) from public.payment_webhook_events where state = 'PROCESSING' group by 1;
```

Do **not** delete queue rows during rollback — leave for operator triage. Disable `process-webhook-retry` to stop new drain attempts.

### pg_net in-flight EF calls

Check recent `job_runs` for charge/reconcile jobs with open rows:

```sql
select job_name, started_at, metadata
from public.job_runs
where finished_at is null
  and job_name in ('schedule-netcred-charges', 'reconcile-netcred-payments', 'detect-netcred-onboarding')
order by started_at desc;
```

## Step 3 — Redeploy Edge Functions (if EF regression)

Redeploy previous known-good versions via Supabase Dashboard or CI:

| Function | Rollback priority |
|----------|---------------------|
| `schedule-netcred-charges` | P1 |
| `netcred-webhook` | P2 |
| `reconcile-netcred-payments` | P2 |
| Others | P3 |

RPCs remain in DB (additive migrations) — no schema rollback.

## Step 4 — Re-enable (after fix)

Follow [`production-rollout-checklist.md`](./production-rollout-checklist.md) after fixing the root cause.

## Emergency contacts

- SRE on-call: alert routing per Task 82 Sentry rules
- NetCred support: gateway-side transaction holds

## Related

- Enable plan: [`phased-cron-enablement-plan.md`](./phased-cron-enablement-plan.md)
- Dead letter recovery: [`operator-dead-letter-runbook.md`](./operator-dead-letter-runbook.md)
