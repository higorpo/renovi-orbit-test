# MMD poison message policy

Defines non-retryable terminal failures that MUST NOT be automatically requeued. Source of truth: `design.md` §8.3.

## Poison `failure_code` values

| Code | Source | Why poison |
|------|--------|------------|
| `invalid_token` | FCM HTTP 404 / unregistered; worker `httpClassifier` | Token will not succeed on retry; beacon disabled via `report_delivery_outcome` |
| `template_render_error` | Worker render/validation (`TemplateSchemaValidationError`, size limits) | Payload or template definition is wrong; retry without fix wastes quota |
| `hard_bounce` | Resend webhook `email.bounced`; `reconcile_vendor_event` | Recipient address is permanently bad |

Additional terminal codes (e.g. `max_retries_exhausted`, `provider_terminal`) are dead-letter but may have been retryable earlier — treat poison set as **never auto-requeue**.

## System behavior

1. Row ends in `FAILED_TERMINAL` with one of the poison codes above.
2. **No** `promote_retries` path applies (terminal FSM has no outbound transitions).
3. **No** MVP `message_dispatcher_force_requeue` admin RPC (out of scope).
4. Cron and worker MUST NOT special-case poison into `QUEUED`.

## Operator response

| Code | Do | Do not |
|------|-----|--------|
| `invalid_token` | Confirm `user_device_beacons.push_enabled = false` for device; ask user to re-open app | Re-ingest same push to same device without new token |
| `template_render_error` | Fix `message_templates` or producer variables; validate against `variable_schema` | Bump `retry_count` via SQL |
| `hard_bounce` | Stop emailing address; update CRM | Retry same `idempotency_key` |

**Re-delivery:** only after root-cause fix, via **new** `message_dispatcher_ingest` with a **new** `idempotency_key`.

## Detection queries

```sql
select failure_code, count(*)
from message_dispatcher.message_dispatches
where status = 'FAILED_TERMINAL'
  and failure_code in ('invalid_token', 'template_render_error', 'hard_bounce')
  and updated_at > now() - interval '7 days'
group by failure_code;
```

## Partial push success (not poison)

One bad device does not poison the parent dispatch: product model marks parent `DELIVERED` when any FCM send succeeds; per-delivery failures may still record `invalid_token` on delivery rows. See design §8.4.

## Related docs

- `operator-runbook-dead-letter.md`
- `operator-runbook-recovery-chain.md`
- `design.md` §8.3, §11.7 (FCM beacon hygiene)
