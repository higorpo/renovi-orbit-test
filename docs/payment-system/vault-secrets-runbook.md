# Payment system — Vault and Edge secrets

Operational runbook for provisioning payment secrets. Design reference: `design.md` §3.1, §11.1; requirements Req 2, 24.

Platform-wide internal EF auth (pg_cron → Edge): **[../internal-edge-functions-auth.md](../internal-edge-functions-auth.md)**.

## Secret inventory

| Secret | Vault name (Postgres) | Edge env var | Consumers | Classification |
|--------|----------------------|--------------|-----------|----------------|
| Installment HMAC signing | `installment_signing_secret` | — (RPC only) | `payment_calculate_installment_options`, `payment_update_method`, `accept_proposal` | **Vault / RPC** |
| Provider pricing HMAC | `pricing_signature_secret` | — (RPC only) | `generate_provider_pricing_signature`, proposal RPCs | **Vault / RPC** |
| NetCred API username | — | `NETCRED_USERNAME` | All payment EFs using `NetCredAdapter` | **Edge secret** |
| NetCred API password | — | `NETCRED_PASSWORD` | All payment EFs using `NetCredAdapter` | **Edge secret** |
| NetCred webhook HMAC | — | `NETCRED_WEBHOOK_SECRET` | `netcred-webhook` | **Edge secret** |
| NetCred GraphQL base URL | — | `NETCRED_API_BASE_URL` | Charge, tokenize, refund, reconcile, onboarding | **Edge config** (non-secret) |
| Platform bank account ID | — | `NETCRED_PLATFORM_BANK_ACCOUNT_ID` | tokenize, manual-charge, schedule, reconcile, refund | **Edge config** |
| Platform company ID | — | `NETCRED_PLATFORM_COMPANY_ID` | `tokenize-payment-card` (optional) | **Edge config** |

**Rule:** never commit real secret values. `.env.example` files contain placeholders only. Production values live in Supabase Dashboard (Vault or Edge Secrets).

## Postgres Vault (RPC secrets)

RPCs read HMAC secrets via `vault.decrypted_secrets` with `SET search_path = public, vault, extensions`.

### Local development

1. Set values in repo root `.env` (see `.env.example`).
2. Map env → Vault in `supabase/config.toml` under `[db.vault]`:

```toml
[db.vault]
orbit_supabase_url = "env(ORBIT_SUPABASE_URL)"
orbit_cron_secret = "env(ORBIT_CRON_SECRET)"
pricing_signature_secret = "env(PRICING_SIGNATURE_SECRET)"
installment_signing_secret = "env(INSTALLMENT_SIGNING_SECRET)"
```

3. Restart local Supabase after changing `[db.vault]` or root `.env`:

```bash
nvm use 24.13 && yarn db:reset   # or: supabase stop && supabase start
```

4. Verify Vault rows:

```bash
npx supabase db query --local \
  "select name from vault.secrets where name in ('installment_signing_secret','pricing_signature_secret') order by 1"
```

### Production / staging

Use **Supabase Dashboard → Project Settings → Vault** (or SQL):

```sql
-- Example: rotate installment signing secret (no migration required)
select vault.create_secret(
  '<new-secret-value>',
  'installment_signing_secret',
  'HMAC for payment_calculate_installment_options / accept_proposal'
);
```

**Rotation (Req 24.5):** update the Vault secret value only. RPCs read on each call — no database migration. In-flight checkout sessions with an old HMAC may fail validation until the client refreshes installment options.

## Edge Function secrets (NetCred)

Payment Edge Functions load secrets via `getEnvSecret()` (`NETCRED_USERNAME`, `NETCRED_PASSWORD`, `NETCRED_WEBHOOK_SECRET`). Non-secret config uses `Deno.env.get()` directly.

### Functions and required secrets

| Function | Required secrets / config |
|----------|---------------------------|
| `tokenize-payment-card` | `NETCRED_*` auth, `NETCRED_API_BASE_URL`, `NETCRED_PLATFORM_BANK_ACCOUNT_ID` |
| `manual-charge-payment` | Same + JWT client auth (user Bearer) |
| `schedule-netcred-charges` | Same (cron via pg_net) |
| `reconcile-netcred-payments` | Same (cron via pg_net) |
| `detect-netcred-onboarding` | Same |
| `process-refund` | Same |
| `netcred-webhook` | `NETCRED_WEBHOOK_SECRET` only (public ingress; no NetCred JWT) |

Shared module: `supabase/functions/_shared/payment/netcred-auth.ts`. Secret key list: `NETCRED_ENV_SECRET_KEYS` in `constants.ts`.

### Local development

1. Copy `supabase/functions/.env.example` → `supabase/functions/.env`.
2. Fill NetCred sandbox credentials from NetCred partner portal.
3. Ensure `ORBIT_CRON_SECRET` matches repo root `.env` (for cron-invoked EFs).
4. Start Supabase: `supabase start` (loads `supabase/functions/.env` into Edge runtime).

```bash
# supabase/functions/.env (local sandbox — never commit)
NETCRED_USERNAME=sandbox-user@example.com
NETCRED_PASSWORD=sandbox-password
NETCRED_WEBHOOK_SECRET=local-webhook-hmac-secret
NETCRED_API_BASE_URL=https://api.sandbox.netcredbrasil.com.br
NETCRED_PLATFORM_BANK_ACCOUNT_ID=12345
NETCRED_PLATFORM_COMPANY_ID=67890
ORBIT_CRON_SECRET=local-dev-orbit-cron-secret-min-32-chars
```

### Production / staging

**Supabase Dashboard → Edge Functions → Secrets:** set all `NETCRED_*` keys for the project. Use production GraphQL URL and production credentials. Register webhook URL with NetCred using the same `NETCRED_WEBHOOK_SECRET` value.

**Rotation (webhook secret):** update Edge secret + NetCred webhook configuration. No migration. Redeploy is not required — Edge reads secrets at cold start; new invocations pick up the new value.

**Rotation (NetCred username/password):** update Edge secrets; next `tokenAuth` refresh uses new credentials. Clear stale JWT if needed: `DELETE FROM payment_gateway_tokens WHERE gateway_slug = 'netcred'` (forces refresh on next EF call).

## Sandbox vs production guard (Req 2 AC5)

In production, `NetCredAdapter` asserts `user.sandbox === false` after `tokenAuth`. Sandbox credentials against production URL emit **CRITICAL** Sentry (`NETCRED_AUTH_FAILURE`) and abort the operation.

## Provisioning checklist

### New environment (staging)

- [ ] Root `.env`: `INSTALLMENT_SIGNING_SECRET`, `PRICING_SIGNATURE_SECRET`, `ORBIT_*` (local only)
- [ ] Postgres Vault: `installment_signing_secret`, `pricing_signature_secret`, `orbit_supabase_url`, `orbit_cron_secret`
- [ ] Edge Secrets: `NETCRED_USERNAME`, `NETCRED_PASSWORD`, `NETCRED_WEBHOOK_SECRET`, `NETCRED_API_BASE_URL`, `NETCRED_PLATFORM_BANK_ACCOUNT_ID`, `ORBIT_CRON_SECRET`
- [ ] NetCred dashboard: webhook URL → `{SUPABASE_URL}/functions/v1/netcred-webhook`
- [ ] Smoke: `payment_calculate_installment_options` returns `installment_selection_hmac`
- [ ] Smoke: `netcred-webhook` rejects unsigned POST with HTTP 401

### Secret leak response

1. Rotate affected secret in Vault or Edge Secrets immediately.
2. For NetCred password: rotate in NetCred portal + Edge secret + invalidate `payment_gateway_tokens`.
3. For webhook secret: rotate in NetCred webhook config + Edge secret.
4. Audit `payment_webhook_events` and Sentry for anomalous ingress during exposure window.

## Related docs

- `design.md` §3.1 (gateway config), §11.1 (PCI / secrets)
- `docs/message-dispatcher/docs/edge-secrets.md` (MMD pattern)
- `docs/internal-edge-functions-auth.md` (pg_cron → EF auth)
