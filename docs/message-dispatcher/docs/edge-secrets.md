# MMD Edge secrets configuration

Secrets for MMD Edge Functions. Platform-wide internal EF auth: **[../../internal-edge-functions-auth.md](../../internal-edge-functions-auth.md)**.

## Required secrets

| Secret | Function | Purpose |
|--------|----------|---------|
| **`ORBIT_CRON_SECRET`** | `message-dispatcher-worker` (+ all internal EFs) | pg_net auth: `Authorization` Bearer + `X-Orbit-Cron-Secret` |
| `RESEND_API_KEY` | `message-dispatcher-worker` | Outbound email via Resend API |
| `FCM_SERVICE_ACCOUNT` | `message-dispatcher-worker` | Firebase service account JSON (single line) for push |
| `RESEND_WEBHOOK_SECRET` | `message-dispatcher-webhook-resend` | Svix signature verification for inbound webhooks |

## Supabase-injected (automatic)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Service client in worker/webhook |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev/manual fallback for `validateOrbitCronAuth` |

## Postgres Vault (pg_net caller)

| Vault name | .env (repo root) | Purpose |
|------------|------------------|---------|
| `orbit_supabase_url` | `ORBIT_SUPABASE_URL` | e.g. `http://127.0.0.1:54321` (no `/functions/v1/...` path) |
| `orbit_cron_secret` | `ORBIT_CRON_SECRET` | Same value as Edge `ORBIT_CRON_SECRET` |

## Optional

| Secret | Purpose |
|--------|---------|
| `SENTRY_DSN` | Edge tracing |
| `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME` | Sender identity for Resend |
| `ALLOWED_ORIGINS` | CORS for Edge (shared with other functions) |
| `INBUCKET_SMTP_*` | Local email via Mailpit instead of Resend |

## Local development

1. Copy `.env.example` (repo root) and `supabase/functions/.env.example` → respective `.env`
2. Set **`ORBIT_SUPABASE_URL`** and **`ORBIT_CRON_SECRET`** in repo root `.env` (Vault)
3. Set **`ORBIT_CRON_SECRET`** in `supabase/functions/.env` (Edge runtime) — **same value**
4. Fill MMD-specific values (`RESEND_*`, `FCM_*`) before `supabase start`

```bash
# Repo root .env
ORBIT_SUPABASE_URL=http://127.0.0.1:54321
ORBIT_CRON_SECRET=CHANGE_ME_GENERATE_RANDOM_32+

# supabase/functions/.env
ORBIT_CRON_SECRET=CHANGE_ME_GENERATE_RANDOM_32+
RESEND_API_KEY=re_xxxx
FCM_SERVICE_ACCOUNT={"type":"service_account",...}
```

## Production (Supabase Dashboard)

**Project Settings → Edge Functions → Secrets:** set `ORBIT_CRON_SECRET`, `RESEND_*`, `FCM_*`, etc.

**Vault (SQL):** set `orbit_supabase_url` and `orbit_cron_secret` to production project URL and the same cron secret.

Register Resend webhook URL pointing to `message-dispatcher-webhook-resend`. Enable `mmd_invoke_worker` only after Phase 2 checklist.

## Rollout gate

Do **not** enable `mmd_invoke_worker` until Phase 1 is complete and secrets are validated in staging. Phase 2 GA: `rollout-phase-2-checklist.md` + `mmd-rollout-phase2-enable-worker.sql`.
