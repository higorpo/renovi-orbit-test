# MMD Edge secrets configuration

Secrets for MMD Edge Functions only. Source of truth: `design.md` §11.6. Never expose in the web/mobile client bundle.

## Required secrets

| Secret | Function | Purpose |
|--------|----------|---------|
| `DISPATCHER_CRON_SECRET` | `message-dispatcher-worker` | Auth for `pg_net` cron POST (`Authorization` + `X-Dispatcher-Secret`) |
| `RESEND_API_KEY` | `message-dispatcher-worker` | Outbound email via Resend API |
| `FCM_SERVICE_ACCOUNT` | `message-dispatcher-worker` | Firebase service account JSON (single line) for push |
| `RESEND_WEBHOOK_SECRET` | `message-dispatcher-webhook-resend` | Svix signature verification for inbound webhooks |

## Supabase-injected (automatic)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Service client in worker/webhook |
| `SUPABASE_SERVICE_ROLE_KEY` | Alternative bearer for worker auth |

## Optional

| Secret | Purpose |
|--------|---------|
| `SENTRY_DSN` | Edge tracing (task 81) |
| `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME` | Sender identity for Resend |
| `ALLOWED_ORIGINS` | CORS for Edge (shared with other functions) |

## Local development

1. Copy `supabase/functions/.env.example` → `supabase/functions/.env`
2. Fill MMD values before `supabase start`
3. Set matching `message_dispatcher.cron_secret` in `platform_constants` (migration seeds empty; update for local pg_net invoke)

```bash
# Example local .env fragment
DISPATCHER_CRON_SECRET=dev-cron-secret-min-16-chars
RESEND_API_KEY=re_xxxx
RESEND_WEBHOOK_SECRET=whsec_xxxx
FCM_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
```

## Production (Supabase Dashboard)

**Project Settings → Edge Functions → Secrets**

Set each key above. Register Resend webhook URL pointing to `message-dispatcher-webhook-resend`. Set `message_dispatcher.worker_url` and `message_dispatcher.cron_secret` in `platform_constants` before enabling `mmd_invoke_worker`.

## Rollout gate

Do **not** enable `mmd_invoke_worker` until Phase 1 is complete and secrets are validated in staging. Phase 2 GA: `rollout-phase-2-checklist.md` + `mmd-rollout-phase2-enable-worker.sql` (design §13.1).
