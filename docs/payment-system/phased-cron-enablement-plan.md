# Payment system — production deploy

Direct production launch (no phased rollout or shadow mode). Crons are registered **active** on deploy via migration `20260801710000_payment_register_cron_jobs.sql`.

## Pre-deploy checklist

- [ ] Migrations applied (through `20260801730000` minimum)
- [ ] Seven payment Edge Functions deployed
- [ ] Vault + Edge secrets per [`vault-secrets-runbook.md`](./vault-secrets-runbook.md)
- [ ] `ORBIT_CRON_SECRET` configured for pg_cron → EF auth
- [ ] NetCred production credentials (not sandbox)

## Verify crons after deploy

```sql
select jobname, schedule, active
from cron.job
where jobname in (
  'payment_recover_orphaned_schedules',
  'process-webhook-retry',
  'reconcile-netcred-payments',
  'notify-upcoming-charges',
  'auto-cancel-unpaid-services',
  'schedule-netcred-charges',
  'detect-netcred-onboarding',
  'auto-complete-executed-services'
)
order by jobname;
```

Expected: eight rows, all **`active = true`**.

## Post-deploy monitoring

```sql
select job_name, finished_at, error_count, metadata->>'fatal_error' as fatal_error
from public.job_runs
where job_name like '%netcred%' or job_name like '%webhook%' or job_name like '%payment%'
order by started_at desc
limit 20;
```

## Incident response

| Situation | Doc |
|-----------|-----|
| Disable crons / drain queues | [`payment-rollback-runbook.md`](./payment-rollback-runbook.md) |
| Dead letter webhook / audit timeline | [`operator-dead-letter-runbook.md`](./operator-dead-letter-runbook.md) |

## Related

- Design §6.4: pg_cron → `payment_cron_*()` wrappers only
- Load test (optional pre-launch): [`load-test-claim-batch.md`](./load-test-claim-batch.md)
