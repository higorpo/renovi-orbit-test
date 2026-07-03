# Payment production deploy checklist (Task 102)

Use after migrations + Edge Functions are deployed. See [`phased-cron-enablement-plan.md`](./phased-cron-enablement-plan.md) (production deploy guide).

## Deploy verification

- [ ] All eight payment pg_cron jobs exist and are **active**
- [ ] First `job_runs` row per cron completes without `fatal_error`
- [ ] Test checkout + tokenize in production NetCred
- [ ] Webhook endpoint `netcred-webhook` reachable from NetCred
- [ ] Sentry payment alerts receiving events (Task 82)

## Cron inventory

| `cron.job.jobname` | Wrapper | Schedule (UTC) |
|--------------------|---------|----------------|
| `payment_recover_orphaned_schedules` | `payment_cron_recover_orphaned_schedules()` | `*/30 * * * *` |
| `process-webhook-retry` | `payment_cron_process_webhook_retry()` | `*/5 * * * *` |
| `reconcile-netcred-payments` | `payment_cron_reconcile_netcred_payments()` | `*/30 * * * *` |
| `notify-upcoming-charges` | `payment_cron_notify_upcoming_charges()` | `30 9,15,21,3 * * *` |
| `auto-cancel-unpaid-services` | `payment_cron_auto_cancel_unpaid_services()` | `15 9,15,21,3 * * *` |
| `schedule-netcred-charges` | `payment_cron_schedule_netcred_charges()` | `0 9,15,21,3 * * *` |
| `detect-netcred-onboarding` | `payment_cron_detect_netcred_onboarding()` | `0 10 * * *` |
| `auto-complete-executed-services` | `payment_cron_auto_complete_executed_services()` | `45 9,15,21,3 * * *` |

## Rollback

[`payment-rollback-runbook.md`](./payment-rollback-runbook.md)
