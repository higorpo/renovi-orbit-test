# Staging checklist — `matching.new_opportunity` (MMD)

Verify batch notification delivery after progressive matching deploy. Worker uses generic template fetch/render — no worker allowlist change required.

**Full pipeline (OPEN SR → cron → feed):** see [`staging-full-batch-path-checklist.md`](./staging-full-batch-path-checklist.md).

## Prerequisites

- Staging Supabase with matching migrations applied (M11a/b templates + batch trigger).
- `message-dispatcher-worker` enabled (`mmd_invoke_worker` / cron checkout per [edge-secrets.md](../../message-dispatcher/docs/edge-secrets.md)).
- Resend + FCM credentials configured for staging.
- Test provider profile with verified email and at least one active FCM device token (for push happy path).

## 1. Ingest contract (DB)

1. Open a batch for an OPEN service request (cron or manual `matching_open_batch`).
2. Confirm `service_request_dispatch_batch_providers` insert creates **two** rows in `message_dispatcher.message_dispatches`:
   - `template_key = 'matching.new_opportunity'`
   - channels: `push` and `email`
   - `bypass_limits = false` on both
3. Confirm idempotency keys match `dispatch:{sr_id}:batch:{n}:provider:{provider_id}:{channel}`.
4. Confirm `template_variables` JSON includes: `service_request_id`, `title`, `service_name`, `neighborhood`, `urgency`, `deep_link_path` (no `distance_km`).

## 2. Push delivery (FCM)

1. Provider with valid push token receives notification after worker checkout.
2. Push body matches template: `{title} — {neighborhood}`.
3. Deep link opens provider jobs route (`/dashboard/jobs` or app equivalent).

## 3. Email delivery (Resend)

1. Provider receives email with subject `Nova oportunidade: {title}`.
2. Body includes service name, neighborhood, urgency, and link from `deep_link_path`.

## 4. Terminal states (acceptable failures)

These **must not** block dispatch or visibility — only notification delivery:

| Scenario | Expected MMD terminal state |
|----------|----------------------------|
| Provider has no FCM tokens / devices offline | `no_push_targets` on push dispatch |
| Provider exceeded daily push quota | `push_daily_quota_exceeded` |
| Provider exceeded daily email quota | `email_daily_quota_exceeded` |

After terminal push failure, email may still deliver when quota and recipient allow.

## 5. Quota enforcement

1. Seed provider at daily push/email limit (`message_dispatcher_user_limits` + prior dispatches in 24h window).
2. Ingest new batch notification with `bypass_limits = false`.
3. Confirm new dispatches respect quota (terminal or scheduled per MMD rules) — **not** bypassed.

## 6. Observability

- `message_dispatcher_audit` / delivery reports show outcome per channel.
- Worker logs include `template_key: matching.new_opportunity` on render/send spans.
- Dashboard: batch notification delivery ratio (design §10.3).

## Automated coverage (local CI)

- pgTAP: `supabase/tests/matching/mmd_new_opportunity_template_test.sql`, `mmd_batch_provider_notify_test.sql`
- Deno: `message-dispatcher-worker/__tests__/matching_new_opportunity_test.ts`, `integration_matching_new_opportunity_test.ts`
