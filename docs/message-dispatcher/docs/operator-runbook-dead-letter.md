# MMD operator runbook — dead-letter (`FAILED_TERMINAL`)

Operational guide for terminal failures. Source of truth: `design.md` §10.6, §8.3.

## What is the dead-letter store?

There is **no separate queue**. Rows in `message_dispatcher.message_dispatches` with `status = 'FAILED_TERMINAL'` are the dead-letter record. Forensics use:

- `failure_code` — machine-readable category
- `failure_reason` — human-readable detail (provider body, quota message, etc.)
- `correlation_id` — trace across Edge logs and Resend/FCM
- `message_dispatcher_audit` — FSM history via `message_dispatcher_audit_timeline(dispatch_id)`

**MVP policy:** no automatic requeue from `FAILED_TERMINAL`. Corrective delivery requires a **new ingest** with a **new** `idempotency_key` after fixing root cause.

## Common queries (`service_role`)

Recent dead letters (last 24h):

```sql
select
  id,
  profile_id,
  channel,
  template_key,
  failure_code,
  failure_reason,
  correlation_id,
  source_system,
  created_at,
  updated_at
from message_dispatcher.message_dispatches
where status = 'FAILED_TERMINAL'
  and created_at > now() - interval '1 day'
order by updated_at desc
limit 100;
```

Group by failure code (volume triage):

```sql
select failure_code, count(*) as cnt
from message_dispatcher.message_dispatches
where status = 'FAILED_TERMINAL'
  and updated_at > now() - interval '1 day'
group by failure_code
order by cnt desc;
```

Single dispatch investigation:

```sql
select message_dispatcher.message_dispatcher_audit_timeline('00000000-0000-0000-0000-000000000000'::uuid);
-- replace with dispatch id
```

## Failure codes (reference)

| `failure_code` | Typical cause | Ops action |
|----------------|---------------|------------|
| `hard_bounce` | Resend bounce webhook | Do not re-send same address; verify email with user |
| `invalid_token` | FCM unregistered / bad token | Beacon disabled by RPC; user must re-register device |
| `template_render_error` | Schema/variables invalid at worker | Fix template or producer payload; new ingest |
| `max_retries_exhausted` | Retry budget spent | Check upstream provider; may be transient storm |
| `lease_expired` + terminal | Orphan reclaim hit max retries | See recovery runbook |
| `email_daily_quota_exceeded` / `push_daily_quota_exceeded` | Product limits | Expected; no retry until window resets |
| `no_email_on_file` / `no_push_targets` | Missing recipient data | Fix profile/beacons; new ingest |
| `provider_terminal` | Non-retryable HTTP from provider | Review `failure_reason` and provider dashboard |

Poison codes (`invalid_token`, `template_render_error`, `hard_bounce`) — see `poison-message-policy.md`.

## Alerts

- Terminal spike: `alert_terminal_spike_v` / `mmd_alert_terminal_spike` (design §10.5)
- Evaluate: `select message_dispatcher.message_dispatcher_evaluate_alerts();`

## Allowed actions

1. Read and export dead-letter rows for support tickets.
2. Correlate with `correlation_id` in Logflare / Sentry.
3. After product approval, **re-ingest** with new `idempotency_key` (never `UPDATE status`).

## Forbidden actions

- `UPDATE message_dispatches SET status = 'QUEUED'` on terminal rows.
- Deleting audit or vendor event rows.
- Reusing the same `idempotency_key` for a different payload.

## Related docs

- `poison-message-policy.md`
- `operator-runbook-recovery-chain.md`
- `operator-runbook-immutable-fields.md`
- `metrics-catalog.md`
