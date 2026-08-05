# Payment production deploy checklist (Task 102)

Use after migrations + Edge Functions are deployed. See [`phased-cron-enablement-plan.md`](./phased-cron-enablement-plan.md) (production deploy guide).

**Pre-production gate:** complete 72h staging soak per [`staging-soak-test-runbook.md`](./staging-soak-test-runbook.md) (Task 128) before Phase E money movement.

**Post-rollout monitoring:** [`payment-job-runs-monitoring.md`](./payment-job-runs-monitoring.md) — `payment_ops_job_health()` + SQL query pack (Task 130).

**Secrets SSOT:** [`vault-secrets-runbook.md`](./vault-secrets-runbook.md) (Vault = RPC HMAC; Edge = NetCred + cron auth).

## Go-live secret gates (must pass before money movement)

- [ ] Vault / Edge secrets are **unique per environment** and **not** equal to `.env.example` placeholders (`CHANGE_ME_GENERATE_RANDOM_32+` or any historical example literals)
- [ ] Generate with `openssl rand -hex 32` (or equivalent) for `orbit_cron_secret`, `installment_signing_secret`, `pricing_signature_secret`, `ORBIT_CRON_SECRET`, `NETCRED_WEBHOOK_SECRET`
- [ ] `ENVIRONMENT` is **unset** or **not** `development` in staging/production Edge secrets (sandbox-credential guard stays on)
- [ ] `ALLOWED_ORIGINS` set to production app origin(s) only (no `*` / empty allow-all)
- [ ] `NETCRED_WEBHOOK_SECRET` set in Edge secrets and registered with NetCred webhook config (same value)
- [ ] Smoke: unsigned `POST` to `netcred-webhook` returns **HTTP 401** (invalid/missing signature)
- [ ] Smoke: `payment_calculate_installment_options` returns `installment_selection_hmac` (Vault installment secret loaded)

## Deploy verification

- [ ] All nine payment pg_cron jobs exist and are **active**
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
| `reconcile-inanalysis-auto-cancel-voids` | `payment_cron_reconcile_inanalysis_auto_cancel_voids()` | `*/30 * * * *` |
| `notify-upcoming-charges` | `payment_cron_notify_upcoming_charges()` | `30 9,15,21,3 * * *` |
| `auto-cancel-unpaid-services` | `payment_cron_auto_cancel_unpaid_services()` | `15 9,15,21,3 * * *` |
| `schedule-netcred-charges` | `payment_cron_schedule_netcred_charges()` | `0 9,15,21,3 * * *` |
| `detect-netcred-onboarding` | `payment_cron_detect_netcred_onboarding()` | `0 10 * * *` |
| ~~`auto-complete-executed-services`~~ | **Removed (Task 40 / ADR-0004)** — use `service_completion_auto_complete_executed` | `45 9,15,21,3 * * *` |

## Rollback

[`payment-rollback-runbook.md`](./payment-rollback-runbook.md)
