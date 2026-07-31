# Internal Edge Functions — pg_net / pg_cron authentication

Orbit uses a **single platform pattern** for Edge Functions invoked by PostgreSQL (`pg_net`) from `pg_cron` or internal SQL wrappers. Reference implementation: MMD `message-dispatcher-worker`; unified in migration `20260801690000_orbit_internal_edge_function_auth.sql`.

## Architecture

```
pg_cron → SECURITY DEFINER wrapper → orbit_invoke_edge_function(slug, body?)
              ↓ pg_net POST
Edge Function (verify_jwt = false) → validateOrbitCronAuth(req)
```

**Never** call `net.http_post` to Edge Function URLs directly from feature migrations — extend `orbit_invoke_edge_function` allowlist instead.

## Edge Functions in this pattern

| Slug | Trigger | Wrapper SQL |
|------|---------|-------------|
| `message-dispatcher-worker` | `mmd_invoke_worker` (every minute) | `message_dispatcher.message_dispatcher_invoke_worker()` |
| `schedule-netcred-charges` | `payment_cron_schedule_netcred_charges` | `payment_cron_invoke_edge_function(...)` |
| `detect-netcred-onboarding` | `payment_cron_detect_netcred_onboarding` | idem |
| `reconcile-netcred-payments` | `payment_cron_reconcile_netcred_payments` | idem |
| `orbit-emit-sentry-alerts` | auto-cancel / webhook-retry / far-recapture crons | `orbit_post_sentry_alerts(...)` |

## Authentication

### Platform gateway

All slugs above: `[functions.<slug>] verify_jwt = false` in `supabase/config.toml`.

### Handler (`validateOrbitCronAuth`)

File: `supabase/functions/_shared/security/orbit-cron-auth.ts`

Accepts either:

1. **Production path (pg_net):** header `X-Orbit-Cron-Secret` matching Edge secret `ORBIT_CRON_SECRET`
2. **Dev / manual ops:** `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`

### pg_net headers (canonical)

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <ORBIT_CRON_SECRET>",
  "X-Orbit-Cron-Secret": "<ORBIT_CRON_SECRET>"
}
```

The Bearer value is the **dedicated cron secret**, not the Supabase service role JWT.

## Secrets checklist

### 1. Edge Functions (Supabase Dashboard → Edge Functions → Secrets)

Set on **every environment** (staging, production):

| Secret | Required | Used by |
|--------|----------|---------|
| **`ORBIT_CRON_SECRET`** | **Yes** (internal EFs) | All 5 internal slugs above |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase | Dev fallback in handlers |
| `SUPABASE_URL` | Auto-injected | EF → Postgres RPCs |

Generate `ORBIT_CRON_SECRET` as a long random string (≥ 32 chars). **Same value** must be available to Postgres (vault below).

Domain-specific secrets (unchanged): `RESEND_*`, `FCM_*`, NetCred, `SENTRY_DSN`, etc.

### 2. Postgres Vault (SQL pg_net caller)

Used by `orbit_invoke_edge_function`:

| Vault name | Purpose |
|------------|---------|
| **`orbit_supabase_url`** | Project API URL **without** path, e.g. `https://<ref>.supabase.co` |
| **`orbit_cron_secret`** | Same value as Edge `ORBIT_CRON_SECRET` |

Optional GUC override for scripts/tests: `app.supabase_url`, `app.cron_secret`.

### 3. Local development (`supabase start`)

Configured in `supabase/config.toml` → `[db.vault]`:

```toml
orbit_supabase_url = "env(ORBIT_SUPABASE_URL)"
orbit_cron_secret = "env(ORBIT_CRON_SECRET)"
```

Set in repo root `.env` (loaded by Supabase CLI) **and** mirror `ORBIT_CRON_SECRET` in `supabase/functions/.env` for Edge runtime:

```bash
ORBIT_SUPABASE_URL=http://127.0.0.1:54321
ORBIT_CRON_SECRET=CHANGE_ME_GENERATE_RANDOM_32+
```

After changing vault env vars: restart Supabase (`supabase stop && supabase start`) or `yarn db:reset`.

## Manual invoke (staging debug)

```bash
curl -X POST "$ORBIT_SUPABASE_URL/functions/v1/message-dispatcher-worker" \
  -H "Authorization: Bearer $ORBIT_CRON_SECRET" \
  -H "X-Orbit-Cron-Secret: $ORBIT_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Adding a new internal EF

1. `[functions.new-slug] verify_jwt = false`
2. Add slug to `orbit_invoke_edge_function` allowlist
3. `validateOrbitCronAuth` at top of handler
4. Cron wrapper calls `orbit_invoke_edge_function`, not raw `net.http_post`
5. Deno test for auth; pgTAP if new wrapper

## Related docs

- MMD domain secrets: `docs/message-dispatcher/docs/edge-secrets.md`
- Payment cron wrappers: `docs/payment-system/design.md` §6.4
