# Payment System — Implementation Baseline

> **Captured:** 2026-06-25  
> **Local DB:** `yarn db:reset` applied; latest migration `20260723120000_expose_service_address_coordinates.sql`  
> **Design reference:** [`design.md`](./design.md) v2.11 · [`tasks.md`](./tasks.md)

This document is the engineering gate for payment subsystem work. It records the verified pre-payment schema state, migration sequencing policy, and extended-RPC source-of-truth workflow required before Tasks 2–32.

---

## 1. Migration sequencing policy

### 1.1 Baseline timestamp

| Item | Value |
|---|---|
| Latest mainline migration | `20260723120000` |
| Next payment migration prefix | `20260801000000` |
| Naming pattern | `YYYYMMDDHHMMSS_payment_<subject>.sql` |

**Rules:**

1. Every new payment migration MUST use a timestamp **strictly after** `20260723120000`.
2. Increment sequentially within the payment wave (e.g. `20260801000000`, `20260801010000`, `20260801020000`, …).
3. Never edit already-applied mainline migrations for payment work — forward-only deltas.
4. Ship **CREATE TABLE + RLS + indexes + REVOKE/GRANT** in the same migration (design.md §11.2).
5. Ship **CREATE RPC + EXECUTE grants** in the same migration (design.md §5.2).
6. pg_cron schedules **`SELECT public.payment_cron_*()`** wrappers only — never batch RPCs or Edge Function URLs directly (design.md §6.4; `.cursor/rules/job-runs-cron-telemetry.mdc`).

### 1.2 Phase rollout (rollback reference)

| Phase | Tasks | Deploy | Rollback |
|---|---|---|---|
| A — Schema only | 2–16 | Migrations; crons **unscheduled** | Unschedule crons (N/A at this phase); forward-only DB |
| B — RPC + EF staging | 17–32, 51+ | Enable pgTAP + Deno tests | Revert EF deploy; RPCs remain (additive) |
| C — Read paths | Frontend checkout | Feature flags | Disable UI routes |
| D — Async workers | Webhook/reconcile crons | Enable `payment_cron_recover_orphaned_schedules`, `payment_cron_process_webhook_retry`, `payment_cron_reconcile_netcred_payments` | Unschedule crons |
| E — Money movement | Charge cron | Enable `payment_cron_schedule_netcred_charges` | Unschedule cron + EF rollback |
| F — Business batches | Auto-cancel, notify, auto-complete, onboarding | Enable remaining crons | Unschedule per job |

DB migrations are **forward-only**. Operational rollback = unschedule pg_cron jobs + redeploy previous Edge Function versions.

---

## 2. Verified DB inventory (pre-payment)

Verified via `npx supabase db query --local` after `yarn db:reset`.

### 2.1 `contracted_services` (existing — to be extended)

| Column | Type | Nullable |
|---|---|---|
| `id` | uuid | NO |
| `service_request_id` | uuid | NO |
| `accepted_proposal_id` | uuid | NO |
| `client_id` | uuid | NO |
| `provider_id` | uuid | NO |
| `duration_unit` | text | NO |
| `duration_value` | integer | NO |
| `scheduled_start_date` | date | NO |
| `scheduled_end_date` | date | YES |
| `scheduled_shift` | text | NO |
| `agreed_slot` | jsonb | NO |
| `status` | contracted_service_status | NO |
| `created_at` | timestamptz | NO |
| `updated_at` | timestamptz | NO |

**No payment lifecycle columns yet** (`confirmed_at`, `executed_at`, `cancelled_at`, etc.) — Task 2.

### 2.2 `contracted_service_status` enum (existing)

Current values (verified):

- `PENDING_PAYMENT`
- `COMPLETED`
- `CANCELLED`

**Not yet present** (Task 2): `CONFIRMED`, `IN_ANALYSIS`, `EXECUTED`, and other payment lifecycle values per design.md §3.0.

Created in `20260701100000_create_cns_enums.sql`; extended in `20260705205000_extend_contracted_service_status_enum.sql`.

### 2.3 `provider_profiles_private` (existing — to be extended)

Current columns: `provider_id`, `entity_type`, `cpf`, `cnpj`, `razao_social`, `nome_fantasia`, `legal_representative_name`, `legal_representative_cpf`, `commercial_contact`, `updated_at`.

**No KYC/banking/onboarding columns yet** — Task 15.

### 2.4 `platform_constants` (existing — to be seeded)

Table exists; **no `payment_*` or `netcred_*` keys** yet — Task 4.

### 2.5 Payment schema (greenfield)

No `payment_*` tables, enums, views, or RPCs exist in the local DB at baseline. No payment Edge Functions under `supabase/functions/`.

### 2.6 Frontend feature module

`src/features/payments/` does **not** exist yet — to be created in later frontend tasks.

---

## 3. Extended RPCs — migration source of truth

Per design.md §5.2, these three RPCs MUST be dumped from live Postgres before any `CREATE OR REPLACE` migration:

| RPC | Signature (baseline) | Dump file |
|---|---|---|
| `accept_proposal` | `(p_proposal_id uuid, p_selected_slot jsonb, p_idempotency_key uuid)` | [`rpc-dumps/accept_proposal.sql`](./rpc-dumps/accept_proposal.sql) |
| `match_provider_jobs` | `(p_provider_id uuid, p_lat double precision, p_lng double precision, p_radius_km integer, p_service_id uuid, p_sort_mode text, p_page_size integer, p_page integer)` | [`rpc-dumps/match_provider_jobs.sql`](./rpc-dumps/match_provider_jobs.sql) |
| `cns_initiate_conversation` | `(p_service_request_id uuid, p_idempotency_key uuid)` | [`rpc-dumps/cns_initiate_conversation.sql`](./rpc-dumps/cns_initiate_conversation.sql) |

### 3.1 Mandatory workflow (before Tasks 25–27)

1. Reset or migrate local DB to latest mainline (`yarn db:reset`).
2. Re-dump all three RPCs:

```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('accept_proposal', 'match_provider_jobs', 'cns_initiate_conversation')
ORDER BY p.proname, p.oid;
```

3. Paste dump into new migration; apply payment deltas on top.
4. Diff against dump if another branch may have touched the same RPC.

**Do not** copy function bodies from design.md snippets, older migrations, or pgTAP fixtures alone.

---

## 4. Architecture invariants (every task)

| Layer | Location | Responsibility |
|---|---|---|
| PostgreSQL RPCs | `supabase/migrations/` | Authoritative state, HMAC (Vault), leases, webhook FSM, batch crons |
| Edge Functions (7) | `supabase/functions/` | PCI + external I/O only — see design.md §5.3 |
| Frontend | `src/features/payments/` | UI + hooks; no direct Supabase mutations |
| API layer | `src/features/payments/api/` | Typed wrappers over RPCs/EFs; no business logic in components |

**Eight Edge Functions (MVP):** `tokenize-payment-card`, `dispatch-kyc-email`, `schedule-netcred-charges`, `manual-charge-payment`, `netcred-webhook`, `process-refund`, `detect-netcred-onboarding`, `reconcile-netcred-payments`.

**New RPC naming:** `payment_<action>_<subject>()` — exceptions only for the three extended RPCs above.

---

## 5. Squad ownership boundaries

| Concern | Owner | Artifacts |
|---|---|---|
| Schema + RPCs + pg_cron | Backend / DB | `supabase/migrations/`, pgTAP in `supabase/tests/payments/` |
| Edge Functions + NetCred adapter | Backend / Edge | `supabase/functions/`, Deno tests |
| Checkout + payment UI | Frontend | `src/features/payments/` |
| Secrets (HMAC, NetCred creds) | Platform / DevOps | Supabase Vault; never in migrations or client |
| Observability | Shared | Sentry (EF), `payment_audit_log`, `job_runs` (crons) |

Cross-cutting reviews: RLS policies (§11.2), idempotency on client mutations (`.cursor/rules/rpc-idempotency-records.mdc`), PCI isolation to `tokenize-payment-card` only.

---

## 6. Pre-implementation checklist

Use this checklist before starting Task 2:

- [x] Local DB reset to latest mainline migration (`20260723120000`)
- [x] `contracted_service_status` enum values verified
- [x] `contracted_services` column inventory captured
- [x] `provider_profiles_private` column inventory captured
- [x] No conflicting `payment_*` objects in DB
- [x] Extended RPC dumps stored in `docs/payment-system/rpc-dumps/`
- [x] Migration naming convention `20260801000000_payment_*` documented
- [x] Rollback strategy per phase documented
- [x] Squad ownership boundaries documented
- [ ] Re-dump extended RPCs immediately before Tasks 25–27 (when CNS/matching may have changed)

---

## 7. Related rules and docs

- [`design.md`](./design.md) — §5.2 (RPC catalog), §5.3 (Edge Functions), §11.2 (RLS)
- [`tasks.md`](./tasks.md) — execution order and dependency graph
- [`payment-system-requirements.md`](./payment-system-requirements.md) — Req 1–33
- [`.cursor/rules/supabase-migrations.mdc`](../../.cursor/rules/supabase-migrations.mdc)
- [`.cursor/rules/job-runs-cron-telemetry.mdc`](../../.cursor/rules/job-runs-cron-telemetry.mdc)
- [`.cursor/rules/api-layer.mdc`](../../.cursor/rules/api-layer.mdc)
- [`.cursor/rules/feature-architecture.mdc`](../../.cursor/rules/feature-architecture.mdc)
