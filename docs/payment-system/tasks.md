# Implementation Tasks — Renovi Payment System

> **Version:** 1.0 — 2026-06-24
> **Status:** Execution Ready
> **Source Documents:** `payment-system-requirements.md` v1.0 · `design.md` v1.0
> **Audience:** Staff Engineers · Backend Engineers · Mobile Engineers · Engineering Management

---

## Execution Strategy

### Overview

The Renovi Payment System is a **database-centric, event-driven orchestration layer** embedded in the Orbit marketplace. All authoritative state lives in PostgreSQL. Edge Functions are stateless I/O connectors. This document transforms the full requirements and architecture into an **operationally executable implementation backlog**.

### Implementation Order Rationale

The execution sequence is strictly bottom-up, driven by dependency topology:

1. **Database Foundation** (Phase 1–2): All schemas, constraints, indexes, and RLS policies MUST exist before any business logic references them. No migrations may be omitted or deferred — every table is a dependency of multiple phases.

2. **PostgreSQL RPCs** (Phase 3): Transactional orchestration logic lives in the database. All Edge Functions delegate state transitions to RPCs. RPCs MUST be implemented and tested before any Edge Function invocation.

3. **pg_cron Scheduling** (Phase 4): Cron jobs invoke Edge Functions. The scheduling engine cannot be registered until the Edge Functions it targets are deployed. However, cron job definitions should be written alongside the EF they invoke — registered only after EF deployment.

4. **Shared Infrastructure** (Phase 5): The `PaymentProvider` interface and `NetCredAdapter` are consumed by all charge-path Edge Functions. They MUST be implemented as a shared module before any gateway-calling EF is written.

5. **Edge Functions — Client-Facing** (Phase 6): Synchronous client-triggered endpoints (tokenize, accept-proposal, HMAC calculation). These are user-blocking and have the highest correctness requirements.

6. **Edge Functions — Cron Workers** (Phase 7): Background processing functions invoked by `pg_cron`. Depend on all RPCs and shared infrastructure.

7. **Webhook Processing** (Phase 8): Inbound event processing. Depends on state machine RPCs and full payment_schedules schema. Must be deployed before any live NetCred connection.

8. **Frontend** (Phase 9): React components, hooks, and stepper flow. Depend on all Edge Function contracts being finalized.

9. **Observability** (Phase 10): Sentry instrumentation and structured logging. Should be added incrementally from Phase 5 onward — formalized in Phase 10 as a dedicated verification pass.

10. **Recovery & Reliability** (Phase 11): Explicitly validates fault-tolerance semantics. Some items are test-only; others require dedicated infrastructure (dead-letter tooling, operator RPCs).

11. **Security & Isolation** (Phase 12): PCI DSS controls, HMAC enforcement, Vault access, RLS audit. A security pass after all components are written.

12. **Performance & Scalability** (Phase 13): Index validation, batch tuning, partition planning. Non-blocking for launch but must complete before production load.

13. **Verification & Rollout** (Phase 14): End-to-end test suites, feature flags, phased rollout, and operational smoke tests.

### Architectural Dependency Map

| Component | Depends On | Unlocks |
|---|---|---|
| `payment_schedules` table | `contracted_services`, `payment_tokens`, `payment_providers` | All charge execution logic |
| `calculate_charge_amount()` RPC | `payment_tokens`, `platform_constants` | `schedule-netcred-charges`, `manual-charge-payment` |
| `accept_proposal_rpc()` | `payment_schedules`, `payment_audit_log` | `accept-proposal` EF |
| `recover_orphaned_payment_schedules()` | `payment_schedules`, `payment_audit_log` | pg_cron janitor job |
| `NetCredAdapter` | `PaymentProvider` interface, `payment_gateway_tokens` | All charge EFs |
| `schedule-netcred-charges` EF | `NetCredAdapter`, all RPCs, `payment_schedules` | T-2 charge pipeline |
| `netcred-webhook` EF | `payment_webhook_events`, all state machine RPCs | Webhook processing pipeline |
| Checkout Stepper (Frontend) | `calculate-installment-options`, `tokenize-payment-card`, `accept-proposal` EFs | Client acceptance flow |

### Risk Isolation Strategy

- **Database-first**: All migrations are additive (no DROP or ALTER COLUMN removal). Every migration is individually reversible.
- **Feature flag**: The entire payment flow is gated behind `feature_flag('payment_system_v1')`. No client exposure until explicitly enabled.
- **Shadow execution**: `schedule-netcred-charges` runs in dry-run mode (logs only, no gateway calls) for the first 72 hours in production.
- **Incremental cron enablement**: Cron jobs are registered but paused (`cron.job.active = false`) until each individual worker passes smoke tests.
- **Phased rollout**: Provider credentialing and client checkout are enabled for a pilot cohort (5% of new service acceptances) before full rollout.

### Rollback Strategy

- All migrations use `up`/`down` scripts. Rollback restores prior schema state.
- Edge Functions are versioned. Previous version remains deployable via Supabase CLI.
- `platform_constants` can be updated to disable features (e.g., `max_charge_attempts = 0` pauses cron retry).
- pg_cron jobs can be paused individually via `SELECT cron.unschedule()`.

---

## Phase 1: Database Foundation

---

### 1. [ ] Bootstrap pg_cron and Required Extensions

**Description:**
Enable and validate all PostgreSQL extensions required by the payment system. The `pg_cron` extension MUST be enabled in the Supabase project settings prior to any cron job registration. The `pgcrypto` extension provides `gen_random_uuid()` used as the default PK for all payment tables. `pg_stat_statements` is required for query performance monitoring.

**Responsibilities:**
- Enable `pg_cron` extension in the Supabase project dashboard.
- Confirm `pgcrypto` is available (default in Supabase PostgreSQL 15+).
- Verify `pg_stat_statements` is enabled for query observability.
- Confirm `cron` schema ownership and `pg_cron` version compatibility (≥ 1.4).
- Establish `supabase_migrations` table presence for migration tracking.

**Implementation Details:**
- Execute `CREATE EXTENSION IF NOT EXISTS pg_cron;` — requires superuser or rds_superuser in Supabase (done via dashboard, not SQL migration).
- Execute `CREATE EXTENSION IF NOT EXISTS pgcrypto;` if not present.
- Validate: `SELECT * FROM cron.job;` returns without error before proceeding to cron registration tasks.
- Confirm `cron.job` schema has columns: `jobid`, `schedule`, `command`, `nodename`, `nodeport`, `database`, `username`, `active`.
- For Supabase-managed pg_cron: Edge Function invocations use `net.http_post()` via `pg_net` extension — confirm `pg_net` is also enabled.

**Deliverables:**
- Migration file: `20260624000001_enable_extensions.sql`
- Validation query confirming all extensions are present.

**Dependencies:**
- Supabase project with PostgreSQL 15+.
- Supabase dashboard access for extension enablement.

**Runtime Guarantees:**
- Extension enablement is idempotent via `CREATE EXTENSION IF NOT EXISTS`.
- No data modifications performed.

**Failure Handling:**
- If `pg_cron` is unavailable: escalate to Supabase support; alternative is Supabase Scheduled Functions (Edge Functions with cron trigger via dashboard).
- If `pg_net` unavailable: all `pg_cron`→EF invocations must use Supabase Scheduled Functions instead.

**Observability:**
- None (infrastructure setup only).

**Security Considerations:**
- Extensions MUST be enabled under the `extensions` schema scope, not `public`.

**Performance Considerations:**
- N/A.

**Requirements covered:** 10, 26
**Acceptance Criteria covered:** 26.1 (all tables), 10A.1

---

### 2. [ ] Create `payment_providers` Table + NetCred Seed

**Description:**
Create the `payment_providers` registry table, which acts as the gateway routing catalog. The `gateway_slug` column (via `slug`) is the foreign key used by all other payment tables for provider routing. NetCred MUST be seeded as the initial provider. This table enables future provider registration (Pagar.me, Asaas, Stripe) without schema changes.

**Responsibilities:**
- Create table with exact schema from design §3.1.
- Enforce UNIQUE constraint on `slug`.
- Seed the NetCred production and sandbox providers.
- Define `is_active` flag to allow gateway disabling without record deletion.

**Implementation Details:**
```sql
CREATE TABLE payment_providers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT        NOT NULL UNIQUE,
  display_name          TEXT        NOT NULL,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  supported_methods     TEXT[]      NOT NULL DEFAULT '{}',
  api_base_url          TEXT        NOT NULL,
  webhook_handler_path  TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO payment_providers (slug, display_name, is_active, supported_methods, api_base_url, webhook_handler_path)
VALUES
  ('netcred', 'NetCred Brasil', TRUE, ARRAY['CREDIT_CARD'], 'https://api.netcredbrasil.com.br/graphql', '/netcred-webhook');
```
- `slug` is the canonical `gateway_slug` referenced in all payment tables.
- `webhook_handler_path` encodes the routing path for the webhook EF dispatcher.
- `supported_methods` TEXT array enables future multi-method adapters without schema changes.

**Deliverables:**
- Migration: `20260624000002_create_payment_providers.sql`
- Seed SQL for NetCred entry.

**Dependencies:**
- Task 1 (extensions).

**Runtime Guarantees:**
- UNIQUE on `slug` prevents duplicate gateway registration.
- `INSERT ... ON CONFLICT DO NOTHING` for seed idempotency.

**Failure Handling:**
- Seed conflict: handled via `ON CONFLICT (slug) DO NOTHING`.

**Observability:**
- None at this layer.

**Security Considerations:**
- No sensitive data in this table.
- `api_base_url` references external endpoints — must be audited before production.

**Performance Considerations:**
- Table is very small (< 10 rows); no indexes required beyond PK and UNIQUE.

**Requirements covered:** 1, 26
**Acceptance Criteria covered:** 26.1 (payment_providers schema)

---

### 3. [ ] Create `payment_gateway_tokens` Table

**Description:**
Create the JWT token cache table for payment gateway authentication. This table holds exactly one row per `gateway_slug`, representing the cached platform-level JWT for calling the gateway API. The `FOR UPDATE` lock on this row serializes concurrent token refresh operations across Edge Function instances, preventing thundering-herd JWT refresh storms.

**Responsibilities:**
- Create table with exact schema from design §3.2.
- Enforce `gateway_slug` as PRIMARY KEY (one row per gateway, guaranteed).
- Ensure `expires_at` and `refreshed_at` columns support the 60-minute expiry check.
- Ensure `token` column supports encrypted storage (Vault reference or pgcrypto encryption).
- Restrict access to `service_role` only (no authenticated access).

**Implementation Details:**
```sql
CREATE TABLE payment_gateway_tokens (
  gateway_slug   TEXT        PRIMARY KEY REFERENCES payment_providers(slug),
  token          TEXT        NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  refreshed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service role only; no RLS required since authenticated role cannot reach this table
REVOKE ALL ON payment_gateway_tokens FROM authenticated;
REVOKE ALL ON payment_gateway_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE ON payment_gateway_tokens TO service_role;
```
- The initial row for `'netcred'` MUST NOT be seeded here; it is inserted by the adapter on first `tokenAuth` call.
- The `FOR UPDATE` lock on this row (in `NetCredAdapter.refreshAuthToken()`) is the primary concurrency-safety mechanism for JWT cache management (design §6.3).
- `token` SHOULD be stored as a Vault reference string (`vault.secrets.id`) rather than a plaintext JWT, to avoid JWT exposure in `pg_dump`.

**Deliverables:**
- Migration: `20260624000003_create_payment_gateway_tokens.sql`
- REVOKE permissions SQL.

**Dependencies:**
- Task 2 (`payment_providers` table).

**Runtime Guarantees:**
- `FOR UPDATE` on this single row serializes all concurrent `tokenAuth` calls.
- One row per gateway; PK enforces invariant.

**Failure Handling:**
- If `tokenAuth` fails: the row is NOT updated; the existing token (may be expired) remains; CRITICAL Sentry emitted; charge execution aborts.

**Observability:**
- `refreshed_at` column provides audit trail for last token refresh.
- `expires_at` column enables monitoring alerts for imminent expiry.

**Security Considerations:**
- `service_role` only. No authenticated user path to this table.
- Token stored encrypted at rest (Vault or pgcrypto).

**Performance Considerations:**
- Single-row table; no indexes needed beyond PK.

**Requirements covered:** 2, 24, 26
**Acceptance Criteria covered:** 2A.1, 2A.2, 2A.3, 26.2 (payment_gateway_tokens schema)

---

### 4. [ ] Create `platform_constants` Table + Full Seed Dataset

**Description:**
Create the `platform_constants` key-value configuration table and seed all required constants. This table is the **sole runtime configuration source** for all fee rates, retry limits, lease durations, and operational thresholds. No constant value SHALL be hardcoded in any Edge Function or RPC. Updates to this table take effect immediately on the next Edge Function invocation without redeployment.

**Responsibilities:**
- Create table with `key` as PRIMARY KEY.
- Seed all required constants with their default values.
- Validate all required keys are present.
- Document each key with `description` for operator reference.

**Implementation Details:**
```sql
CREATE TABLE platform_constants (
  key         TEXT        PRIMARY KEY,
  value       TEXT        NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_constants (key, value, description) VALUES
  ('cc_visa_master_1x_rate',              '2.39',  'Visa/Master 1x fee rate %'),
  ('cc_visa_master_2_6x_rate',            '2.59',  'Visa/Master 2-6x fee rate %'),
  ('cc_visa_master_7_12x_rate',           '2.79',  'Visa/Master 7-12x fee rate %'),
  ('cc_elo_other_1x_rate',                '2.69',  'Elo/Other 1x fee rate %'),
  ('cc_elo_other_2_6x_rate',              '2.89',  'Elo/Other 2-6x fee rate %'),
  ('cc_elo_other_7_12x_rate',             '3.19',  'Elo/Other 7-12x fee rate %'),
  ('cc_fixed_processing_fee_brl',         '0.39',  'Fixed processing fee BRL'),
  ('max_charge_attempts',                 '3',     'Max automatic cron retry attempts'),
  ('charge_retry_interval_minutes',       '30',    'Minutes between retryable failures'),
  ('payment_lease_duration_minutes',      '10',    'PROCESSING lock TTL minutes'),
  ('provider_onboarding_batch_size',      '50',    'Max providers per onboarding cron batch'),
  ('auto_cancel_hours_before_service',    '12',    'T-12h auto-cancellation threshold hours'),
  ('scheduled_charge_hours_before_service','48',   'T-2 charge scheduling offset hours'),
  ('installment_hmac_expires_minutes',    '10',    'HMAC payload TTL minutes'),
  ('reconciliation_poll_interval_minutes','30',    'Stale record reconciliation interval minutes'),
  ('webhook_base_retry_interval_minutes', '5',     'Exponential backoff base for webhook retry')
ON CONFLICT (key) DO NOTHING;
```
- Edge Functions MUST read ALL relevant constants at invocation start via a single `SELECT key, value FROM platform_constants WHERE key = ANY(ARRAY[...])` call.
- Missing key MUST fall back to hardcoded safe default AND emit WARN log.
- `max_charge_attempts` read by cron eligibility query uses the CURRENT value — enabling dynamic retry budget adjustment for existing `FAILED` schedules (Req 11 AC7).

**Deliverables:**
- Migration: `20260624000004_create_platform_constants.sql`
- Seed SQL for all 16 required constants.
- Validation query confirming all keys exist.

**Dependencies:**
- Task 1 (extensions).

**Runtime Guarantees:**
- `ON CONFLICT DO NOTHING` ensures idempotent seeding.
- `key` TEXT PK with `PRIMARY KEY` enforces unique key names.

**Failure Handling:**
- Missing constant: EF reads default, logs WARN, proceeds.
- Incorrect value type (non-numeric): EF MUST catch cast error and use hardcoded default.

**Observability:**
- `updated_at` column tracks last ops modification.
- WARN log on every missing key access.

**Security Considerations:**
- Read-accessible by `service_role` and `authenticated` (read-only for client fee display).
- Write restricted to `service_role` and admin roles only.

**Performance Considerations:**
- Single bulk SELECT at invocation start; no per-key round trips.
- Table is tiny (< 20 rows); full scan is acceptable.

**Requirements covered:** 25, 7, 10, 11
**Acceptance Criteria covered:** 25A.1, 25A.2, 25A.3, 25A.4, 25A.5

---

### 5. [ ] Create `payment_tokens` Table + RLS Policies

**Description:**
Create the `payment_tokens` table for storing PCI-compliant card tokenization references. This table MUST NOT contain raw PAN or CVV at any point — schema design enforces this via column omission, not application-level validation alone. The UNIQUE constraint on `(client_id, provider_payment_profile_id)` prevents duplicate token records for the same card at the same gateway.

**Responsibilities:**
- Create table with exact schema from design §3.3.
- Enforce `state` CHECK constraint for valid states.
- Enforce UNIQUE on `(client_id, provider_payment_profile_id)`.
- Create index `idx_payment_tokens_client_state` on `(client_id, state)`.
- Configure RLS: clients see only their own tokens.
- Confirm no PAN/CVV columns exist via schema audit.

**Implementation Details:**
```sql
CREATE TABLE payment_tokens (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID        NOT NULL REFERENCES profiles(id),
  provider_id                 UUID        NOT NULL REFERENCES payment_providers(id),
  provider_payment_profile_id TEXT        NOT NULL,
  card_number_masked          TEXT        NOT NULL,
  card_brand                  TEXT        NOT NULL,
  provider_card_token         TEXT        NOT NULL,
  expiry_month                SMALLINT    NOT NULL CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year                 SMALLINT    NOT NULL,
  cardholder_name             TEXT        NOT NULL,
  billing_address             JSONB       NOT NULL,
  state                       TEXT        NOT NULL DEFAULT 'ACTIVE'
                              CHECK (state IN ('ACTIVE','EXPIRED','REVOKED','TOKENIZATION_FAILED')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, provider_payment_profile_id)
);

CREATE INDEX idx_payment_tokens_client_state ON payment_tokens(client_id, state);

ALTER TABLE payment_tokens ENABLE ROW LEVEL SECURITY;

-- Client sees only own tokens
CREATE POLICY "payment_tokens_client_select"
  ON payment_tokens FOR SELECT
  USING (auth.uid() = client_id);

-- Only service_role can INSERT/UPDATE
CREATE POLICY "payment_tokens_service_insert"
  ON payment_tokens FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "payment_tokens_service_update"
  ON payment_tokens FOR UPDATE
  USING (TRUE);

-- REVOKE direct client write access
REVOKE INSERT, UPDATE, DELETE ON payment_tokens FROM authenticated;
```
- `billing_address` JSONB schema: `{street, number, district, city, state, zipCode, additionalDetails}`.
- `card_number_masked` format: `'497010XXXXXX0048'` — first 6 and last 4 digits with X masking.
- `provider_id` references `payment_providers.id` (not `payment_providers.slug`); the FK uses UUID to match the gateway that issued the token.
- No `payment_profile_id` or `token_raw` columns — PCI compliance by design.

**Deliverables:**
- Migration: `20260624000005_create_payment_tokens.sql`
- RLS policy SQL.
- PCI schema audit checklist (no PAN/CVV columns confirmed).

**Dependencies:**
- Task 2 (`payment_providers`).
- `profiles` table must exist.

**Runtime Guarantees:**
- UNIQUE on `(client_id, provider_payment_profile_id)` prevents duplicate tokenization records.
- RLS ensures cross-client token leakage is structurally impossible.

**Failure Handling:**
- Duplicate insert conflict: EF detects and returns existing token ID.
- Invalid state transition: application-level check (no DB trigger needed for simple state).

**Observability:**
- `state` column enables monitoring of REVOKED/EXPIRED card volumes.

**Security Considerations:**
- RLS: `auth.uid() = client_id` for SELECT.
- No raw card data columns — enforced at schema level.
- `billing_address` JSONB MUST be treated as PII; excluded from diagnostic logs.

**Performance Considerations:**
- `idx_payment_tokens_client_state` covers: saved card display (WHERE client_id=X AND state='ACTIVE'), revocation check.

**Requirements covered:** 6, 24, 26, 28
**Acceptance Criteria covered:** 6A.3, 24A.2, 26A.3, 28A.1

---

### 6. [ ] Create `provider_accounts` Table + Partial Indexes

**Description:**
Create the `provider_accounts` credentialing state machine table. This table governs the lifecycle of service provider onboarding with the payment gateway. The partial index on `onboarding_status` covering only `('DOCUMENTS_SUBMITTED', 'UNDER_NETCRED_REVIEW')` is critical for the daily onboarding detection cron — it ensures the cron query touches only records that need evaluation.

**Responsibilities:**
- Create table with exact schema from design §3.4.
- Enforce `onboarding_status` CHECK constraint.
- Enforce UNIQUE on `(provider_user_id, gateway_slug)`.
- Create partial index for onboarding cron query optimization.
- Create index for marketplace access gate RPC.

**Implementation Details:**
```sql
CREATE TABLE provider_accounts (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id          UUID        NOT NULL REFERENCES profiles(id),
  gateway_slug              TEXT        NOT NULL REFERENCES payment_providers(slug),
  document                  TEXT        NOT NULL,
  netcred_company_id        TEXT,
  netcred_bank_account_id   TEXT,
  onboarding_status         TEXT        NOT NULL DEFAULT 'PENDING_DOCUMENTS'
                            CHECK (onboarding_status IN (
                              'PENDING_DOCUMENTS','DOCUMENTS_SUBMITTED',
                              'UNDER_NETCRED_REVIEW','ACTIVE','REJECTED','SUSPENDED'
                            )),
  onboarding_submitted_at   TIMESTAMPTZ,
  onboarding_activated_at   TIMESTAMPTZ,
  email_dispatched_at       TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_user_id, gateway_slug)
);

-- Partial index for onboarding detection cron (only pending records)
CREATE INDEX idx_provider_accounts_status
  ON provider_accounts(onboarding_status)
  WHERE onboarding_status IN ('DOCUMENTS_SUBMITTED','UNDER_NETCRED_REVIEW');

-- Full scan index for match_provider_jobs() access gate
CREATE INDEX idx_provider_accounts_user
  ON provider_accounts(provider_user_id);
```
- `netcred_company_id` and `netcred_bank_account_id` MUST both be non-NULL before `onboarding_status = 'ACTIVE'` is committed — enforced in the RPC (Task 24), not just CHECK constraint.
- `email_dispatched_at` is set AFTER the Resend call succeeds; NULL means email is pending/failed.
- `document` stores CPF or CNPJ digits only (no formatting characters).

**Deliverables:**
- Migration: `20260624000006_create_provider_accounts.sql`
- Partial index SQL.

**Dependencies:**
- Task 2 (`payment_providers`).
- `profiles` table.

**Runtime Guarantees:**
- UNIQUE on `(provider_user_id, gateway_slug)` ensures one credentialing record per provider-gateway pair.
- Partial index ensures onboarding cron query is O(pending_count) not O(total_count).

**Failure Handling:**
- Duplicate insertion: `ON CONFLICT DO NOTHING` in the RPC.

**Observability:**
- `email_dispatched_at` IS NULL alerts indicate pending KYC email retries.
- `onboarding_activated_at` tracks activation latency.

**Security Considerations:**
- RLS: provider sees only their own record.
- `document` field contains PII (CPF/CNPJ) — restricted access.

**Performance Considerations:**
- Partial index eliminates full table scans for onboarding cron.

**Requirements covered:** 3, 4, 29
**Acceptance Criteria covered:** 3A.4, 4A.1, 29A.1

---

### 7. [ ] Create `provider_kyc_submissions` Table + RLS

**Description:**
Create the append-only KYC submission record table. This table stores all fields submitted by providers during KYC registration, including document attachment URLs. It is the authoritative local record of what was sent to `credenciamento@renovi.com.br`. Contains PII and MUST be subject to LGPD data retention policies.

**Responsibilities:**
- Create table with schema from design §3.10.
- Enforce entity_type CHECK constraint.
- Create index on `provider_user_id`.
- Configure RLS: provider sees only own submissions; service_role unrestricted.

**Implementation Details:**
```sql
CREATE TABLE provider_kyc_submissions (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id            UUID        NOT NULL REFERENCES profiles(id),
  entity_type                 TEXT        NOT NULL CHECK (entity_type IN ('CPF','CNPJ')),
  full_name                   TEXT        NOT NULL,
  document                    TEXT        NOT NULL,
  phone                       TEXT        NOT NULL,
  email                       TEXT        NOT NULL,
  bank_institution_code       TEXT        NOT NULL,
  bank_branch                 TEXT        NOT NULL,
  bank_account                TEXT        NOT NULL,
  pix_key                     TEXT,
  razao_social                TEXT,
  nome_fantasia               TEXT,
  legal_rep_full_name         TEXT,
  legal_rep_cpf               TEXT,
  legal_rep_phone             TEXT,
  identity_doc_url            TEXT        NOT NULL,
  address_proof_url           TEXT        NOT NULL,
  corporate_charter_url       TEXT,
  legal_rep_doc_url           TEXT,
  submitted_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kyc_submissions_provider ON provider_kyc_submissions(provider_user_id);

ALTER TABLE provider_kyc_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kyc_submissions_provider_select"
  ON provider_kyc_submissions FOR SELECT
  USING (auth.uid() = provider_user_id);
```
- For CNPJ submissions: `razao_social`, `nome_fantasia`, `legal_rep_full_name`, `legal_rep_cpf`, `legal_rep_phone`, `corporate_charter_url`, `legal_rep_doc_url` MUST be non-NULL (validated in Edge Function, not DB constraint, to allow column reuse for CPF type).
- LGPD compliance note: data retention policy MUST be documented; PII expiry after `X` years should be planned.
- Created atomically in same TX as `provider_accounts.onboarding_status = 'DOCUMENTS_SUBMITTED'` (Req 3 AC4).

**Deliverables:**
- Migration: `20260624000007_create_provider_kyc_submissions.sql`
- RLS policy SQL.
- LGPD retention policy documentation reference.

**Dependencies:**
- Task 6 (`provider_accounts`).

**Runtime Guarantees:**
- Append-only semantics by convention (no UPDATE policy granted to `authenticated`).
- Atomic creation with `provider_accounts` update in same TX.

**Failure Handling:**
- If TX fails after INSERT but before `provider_accounts` UPDATE: full rollback; submission not saved.

**Observability:**
- `submitted_at` tracks KYC submission latency.

**Security Considerations:**
- Contains highly sensitive PII (CPF, CNPJ, bank account, documents URLs).
- `service_role` only for write; provider `SELECT` only for read-back confirmation.

**Performance Considerations:**
- Index on `provider_user_id` for submission history lookup.

**Requirements covered:** 3, 26
**Acceptance Criteria covered:** 3A.2, 3A.3, 3A.4

---

### 8. [ ] Create `payment_schedules` Table + CHECK Constraints + All Indexes

**Description:**
Create the authoritative payment schedule table — the core queue entity for charge execution. This is the most operationally critical table in the payment system. Every column, constraint, and index has a specific operational purpose. The partial index on `state IN ('SCHEDULED','FAILED')` is the primary cron dequeue query target and MUST remain optimized as the queue grows.

**Responsibilities:**
- Create table with exact schema from design §3.5.
- Enforce `state` CHECK constraint for all 12 valid states.
- Enforce UNIQUE on `idempotency_key`.
- Create the cron dequeue partial index (critical path).
- Create service lookup index.
- Create stale-state reconciliation index.
- Document concurrency invariants.

**Implementation Details:**
```sql
CREATE TABLE payment_schedules (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contracted_service_id         UUID        NOT NULL REFERENCES contracted_services(id),
  client_id                     UUID        NOT NULL,
  provider_id                   UUID        NOT NULL,
  gateway_slug                  TEXT        NOT NULL REFERENCES payment_providers(slug),
  payment_token_id              UUID        REFERENCES payment_tokens(id),
  installment_number            SMALLINT    NOT NULL CHECK (installment_number BETWEEN 1 AND 12),
  base_amount                   NUMERIC(12,2) NOT NULL CHECK (base_amount > 0),
  charge_scheduled_at           TIMESTAMPTZ NOT NULL,
  state                         TEXT        NOT NULL DEFAULT 'SCHEDULED'
                                CHECK (state IN (
                                  'SCHEDULED','PROCESSING','PAID','IN_ANALYSIS',
                                  'FAILED','FAILED_PERMANENT','CANCELLED','VOIDED',
                                  'REFUND_REQUESTED','REFUNDED','PARTIALLY_REFUNDED','EXPIRED'
                                )),
  automatic_attempt_count       SMALLINT    NOT NULL DEFAULT 0,
  manual_attempt_count          SMALLINT    NOT NULL DEFAULT 0,
  max_attempts                  SMALLINT    NOT NULL DEFAULT 3,
  locked_until                  TIMESTAMPTZ,
  next_retry_at                 TIMESTAMPTZ,
  idempotency_key               TEXT        NOT NULL UNIQUE,
  clearsale_session_id          TEXT,
  client_ip_address             TEXT,
  upcoming_charge_notified_at   TIMESTAMPTZ,
  is_disputed                   BOOLEAN     NOT NULL DEFAULT FALSE,
  needs_payment_method_update   BOOLEAN     NOT NULL DEFAULT FALSE,
  provider_charge_id            TEXT,
  provider_transaction_id       TEXT,
  paid_at                       TIMESTAMPTZ,
  failed_at                     TIMESTAMPTZ,
  failed_permanently_at         TIMESTAMPTZ,
  cancelled_at                  TIMESTAMPTZ,
  refunded_at                   TIMESTAMPTZ,
  paid_amount                   NUMERIC(12,2),
  refunded_amount               NUMERIC(12,2),
  failure_code                  TEXT,
  failure_reason                TEXT,
  cancellation_reason           TEXT,
  reconciliation_failure_count  SMALLINT    NOT NULL DEFAULT 0,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cron queue dequeue index (CRITICAL PATH)
CREATE INDEX idx_payment_schedules_queue
  ON payment_schedules (charge_scheduled_at, state, locked_until, next_retry_at)
  WHERE state IN ('SCHEDULED','FAILED');

-- Idempotency: prevents duplicate schedule on accept_proposal retry
CREATE UNIQUE INDEX idx_payment_schedules_idempotency
  ON payment_schedules(idempotency_key);

-- Webhook reconciliation / cancellation lookup by service
CREATE INDEX idx_payment_schedules_service
  ON payment_schedules(contracted_service_id);

-- Reconciliation cron: stale intermediate states
CREATE INDEX idx_payment_schedules_stale
  ON payment_schedules(state, updated_at)
  WHERE state IN ('IN_ANALYSIS','PROCESSING','REFUND_REQUESTED');
```
- `automatic_attempt_count` is incremented atomically within the same TX as `state = PROCESSING` — NEVER in a separate statement.
- `max_attempts` is stored per row for informational reference; the cron eligibility query ALWAYS evaluates against `platform_constants.max_charge_attempts` (current value), enabling dynamic retry budget changes without per-row migration.
- `locked_until` + `SKIP LOCKED` is the complete double-processing prevention mechanism.
- `idempotency_key = contracted_service_id` — set at creation, never changes.

**Deliverables:**
- Migration: `20260624000008_create_payment_schedules.sql`
- Index creation SQL (all 4 indexes).
- Concurrency invariants documentation inline.

**Dependencies:**
- Task 2 (`payment_providers`), Task 5 (`payment_tokens`).
- `contracted_services` table must exist.

**Runtime Guarantees:**
- Exactly-once claim via `FOR UPDATE SKIP LOCKED` + `locked_until`.
- Idempotency via UNIQUE `idempotency_key`.
- Atomicity: `state` + `automatic_attempt_count` always updated together.

**Failure Handling:**
- Duplicate `idempotency_key` insert: controlled conflict — EF returns existing record.
- Invalid state transition: caught by CHECK constraint, raises PostgreSQL ERROR.

**Observability:**
- `updated_at` staleness enables reconciliation cron detection.
- `reconciliation_failure_count` tracks unresolvable states.

**Security Considerations:**
- RLS: client and provider see own records. Service_role unrestricted.
- No direct UPDATE by `authenticated` role.

**Performance Considerations:**
- Partial index on `state IN ('SCHEDULED','FAILED')` is the cron hot path — must stay current.
- Hot partition mitigation: as records reach terminal states, they exit the partial index.

**Requirements covered:** 9, 10, 23, 26
**Acceptance Criteria covered:** 9A.1, 10A.1, 10A.2, 23A.1, 26A.4

---

### 9. [ ] Create `payment_attempts` Table (Append-Only)

**Description:**
Create the append-only charge attempt history table. Every cron and manual charge attempt MUST produce one INSERT. This table is the primary diagnostic and analytics source for gateway latency, error patterns, and approval rates. No UPDATE or DELETE is permitted on this table at the application layer.

**Responsibilities:**
- Create table with exact schema from design §3.6.
- Enforce `initiator` and `outcome` CHECK constraints.
- Create index on `(schedule_id, attempt_number)`.
- Revoke UPDATE/DELETE permissions.

**Implementation Details:**
```sql
CREATE TABLE payment_attempts (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id               UUID        NOT NULL REFERENCES payment_schedules(id),
  attempt_number            SMALLINT    NOT NULL,
  initiator                 TEXT        NOT NULL CHECK (initiator IN ('cron','client')),
  initiated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at              TIMESTAMPTZ,
  outcome                   TEXT        CHECK (outcome IN (
                              'PAID','REJECTED','TIMEOUT','ERROR','IN_ANALYSIS','VOIDED'
                            )),
  provider_response_summary JSONB,
  failure_code              TEXT,
  failure_reason            TEXT,
  charge_amount             NUMERIC(12,2),
  gateway_latency_ms        INT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_attempts_schedule
  ON payment_attempts(schedule_id, attempt_number);

REVOKE UPDATE, DELETE ON payment_attempts FROM authenticated;
REVOKE UPDATE, DELETE ON payment_attempts FROM service_role;
-- Only INSERT + SELECT granted
```
- `attempt_number` = `automatic_attempt_count` at the time of the attempt (for cron) or `manual_attempt_count` (for client).
- `provider_response_summary` stores the gateway response JSON summary (NOT the full response — trim to essential fields: `transactionState`, `chargeId`, `transactionId`, `errorCode`).
- `gateway_latency_ms` is computed as `Date.now() - requestStart` in the EF.
- `initiator = 'client'` for manual attempts via `manual-charge-payment` EF.

**Deliverables:**
- Migration: `20260624000009_create_payment_attempts.sql`
- REVOKE SQL.

**Dependencies:**
- Task 8 (`payment_schedules`).

**Runtime Guarantees:**
- Append-only: REVOKE UPDATE/DELETE enforced.
- `schedule_id` FK ensures attempt orphans are impossible.

**Failure Handling:**
- INSERT failure: EF must log but NOT abort the state transition commit.
- The `payment_audit_log` is the authoritative record if `payment_attempts` INSERT fails.

**Observability:**
- `gateway_latency_ms` enables P95 latency dashboards.
- `outcome` + `failure_code` enable approval rate computation.
- Analytics: approval_rate = COUNT(outcome='PAID') / COUNT(*) per schedule_id.

**Security Considerations:**
- `provider_response_summary` MUST NOT contain raw card data.
- `failure_reason` may contain error messages — must be sanitized.

**Performance Considerations:**
- Index on `(schedule_id, attempt_number)` covers all diagnostic queries.

**Requirements covered:** 10, 11, 22, 30
**Acceptance Criteria covered:** 10A.4, 10A.5, 11A.4, 30A.3

---

### 10. [ ] Create `payment_webhook_events` Table + Dedup UNIQUE Constraint

**Description:**
Create the webhook event ingestion and deduplication table. Every webhook POST from NetCred MUST be persisted here BEFORE any validation or processing. The UNIQUE constraint on `(gateway_slug, event_type, provider_event_id)` is the primary deduplication mechanism — it prevents duplicate event processing even when the gateway retries delivery multiple times.

**Responsibilities:**
- Create table with exact schema from design §3.7.
- Enforce UNIQUE on `(gateway_slug, event_type, provider_event_id)`.
- Enforce `state` CHECK constraint.
- Create retry queue index.
- Create dead-letter monitoring index.

**Implementation Details:**
```sql
CREATE TABLE payment_webhook_events (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  gateway_slug      TEXT        NOT NULL,
  event_type        TEXT        NOT NULL,
  provider_event_id TEXT        NOT NULL,
  raw_payload       JSONB       NOT NULL,
  raw_headers       JSONB       NOT NULL,
  state             TEXT        NOT NULL DEFAULT 'RECEIVED'
                    CHECK (state IN (
                      'RECEIVED','VALIDATING','PROCESSING','PROCESSED',
                      'DUPLICATE','FAILED','DEAD_LETTER'
                    )),
  retry_count       SMALLINT    NOT NULL DEFAULT 0,
  next_retry_at     TIMESTAMPTZ,
  processed_at      TIMESTAMPTZ,
  failure_reason    TEXT,
  is_duplicate      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gateway_slug, event_type, provider_event_id)
);

-- Retry queue index
CREATE INDEX idx_webhook_events_retry
  ON payment_webhook_events(state, next_retry_at)
  WHERE state = 'FAILED';

-- Dead-letter monitoring index
CREATE INDEX idx_webhook_events_dead_letter
  ON payment_webhook_events(state, created_at)
  WHERE state = 'DEAD_LETTER';
```
- `raw_payload` is immutable after INSERT (business invariant — raw_payload must never be modified for audit integrity).
- On UNIQUE conflict: EF executes `ON CONFLICT DO NOTHING` then sets `is_duplicate = true` on the existing record.
- `id` is TEXT (not UUID) to support gateway-provided event IDs as the PK if needed in future.

**Deliverables:**
- Migration: `20260624000010_create_payment_webhook_events.sql`
- Index SQL.

**Dependencies:**
- Task 2 (`payment_providers` — for `gateway_slug` reference).

**Runtime Guarantees:**
- UNIQUE constraint guarantees at-most-once processing per `provider_event_id`.
- Raw payload persisted before any validation — events never lost.

**Failure Handling:**
- Duplicate event: `ON CONFLICT DO NOTHING`; return HTTP 200 to gateway.
- Failed processing: `state = 'FAILED'`; retry via exponential backoff cron.

**Observability:**
- `retry_count` tracks retry exhaustion.
- `state = 'DEAD_LETTER'` triggers CRITICAL Sentry alert.
- `processed_at - created_at` = processing latency metric.

**Security Considerations:**
- `raw_payload` MUST NOT contain secrets; NetCred does not include credentials in webhook payloads.
- `raw_headers` retains the `X-NETCRED-Signature` for audit (never used for reprocessing).

**Performance Considerations:**
- Partial indexes cover retry and dead-letter query patterns efficiently.
- JSONB `raw_payload` compression for large payloads.

**Requirements covered:** 16, 17, 19, 26
**Acceptance Criteria covered:** 16A.1, 17A.1, 19A.1, 26A.6

---

### 11. [ ] Create `payment_audit_log` Table + INSERT-Only Permissions

**Description:**
Create the immutable payment audit log table. This is the primary dispute resolution and compliance backbone. Every state transition MUST produce an INSERT in the SAME database transaction as the state change. The `payment_audit_log` MUST be INSERT-only at the application role level — UPDATE and DELETE are denied, making records immutable post-commit.

**Responsibilities:**
- Create table with exact schema from design §3.8.
- Create indexes on `(service_id, created_at)` and `(schedule_id, created_at)`.
- REVOKE UPDATE and DELETE from all application roles.
- GRANT only INSERT and SELECT.
- Confirm `created_at` is set by the database (DEFAULT now()), NOT by the application.

**Implementation Details:**
```sql
CREATE TABLE payment_audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT        NOT NULL,
  entity_type  TEXT        NOT NULL,
  entity_id    UUID        NOT NULL,
  service_id   UUID,
  schedule_id  UUID,
  from_state   TEXT,
  to_state     TEXT,
  actor        TEXT        NOT NULL
               CHECK (actor IN ('cron','client','webhook','support','system')),
  actor_id     UUID,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_service  ON payment_audit_log(service_id, created_at);
CREATE INDEX idx_audit_log_schedule ON payment_audit_log(schedule_id, created_at);

-- Application roles: INSERT + SELECT only
GRANT INSERT, SELECT ON payment_audit_log TO authenticated;
REVOKE UPDATE, DELETE ON payment_audit_log FROM authenticated;
GRANT INSERT, SELECT ON payment_audit_log TO service_role;
REVOKE UPDATE, DELETE ON payment_audit_log FROM service_role;
```
- No `updated_at` column — INSERT-only by design.
- `metadata` JSONB stores: `attempt_number`, `gateway_response_codes`, `charge_amount`, `error_code`, `emergency_scheduling`, `refund_amount`, `penalty_tier`.
- `actor_id` = `auth.uid()` for client-initiated events; NULL for cron/system events.
- Event types enumerated in design §10.3 — MUST all be supported.

**Deliverables:**
- Migration: `20260624000011_create_payment_audit_log.sql`
- Permission SQL.

**Dependencies:**
- Tasks 8, 9 (schedule and service references).

**Runtime Guarantees:**
- Immutability: UPDATE/DELETE denied at DB level.
- Atomicity: always committed in same TX as state change.
- `created_at` is DB-set (cannot be forged by application).

**Failure Handling:**
- If audit INSERT fails: the enclosing TX MUST rollback, preventing state change without audit record.
- No partial state transitions without audit trail.

**Observability:**
- Full payment lifecycle reconstructable from sequential `(service_id, created_at)` query.
- Dispute resolution: query returns complete chronological event sequence.

**Security Considerations:**
- No UPDATE/DELETE — immutability is a security property.
- `actor_id` provides attribution for client-initiated events.

**Performance Considerations:**
- Composite indexes on `(service_id, created_at)` and `(schedule_id, created_at)` cover all audit query patterns.
- Future: monthly partitioning by `created_at` when > 10^5 records.

**Requirements covered:** 22, 26
**Acceptance Criteria covered:** 22A.1, 22A.4, 22A.5, 26A.6

---

### 12. [ ] Create `payment_events` Domain Event Log Table

**Description:**
Create the `payment_events` table as the internal domain event log. This table drives the event-driven architecture for downstream consumers: the Multichannel Message Dispatcher, the analytics subsystem, and future event sourcing consumers. Events are published on every state transition alongside the `payment_audit_log` INSERT, but serve a different purpose: they are the outbox for async consumers (domain event pattern), while `payment_audit_log` is the compliance record.

**Responsibilities:**
- Create table with exact schema from design §3.9.
- Create indexes on `event_type`, `service_id`, and `(aggregate_type, aggregate_id)`.
- Define the canonical event type catalog.
- Confirm event types match design §10.3 event catalog.

**Implementation Details:**
```sql
CREATE TABLE payment_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type     TEXT        NOT NULL,
  aggregate_type TEXT        NOT NULL,
  aggregate_id   UUID        NOT NULL,
  service_id     UUID,
  payload        JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_events_type      ON payment_events(event_type, created_at);
CREATE INDEX idx_payment_events_service   ON payment_events(service_id, created_at);
CREATE INDEX idx_payment_events_aggregate ON payment_events(aggregate_type, aggregate_id, created_at);
```
- Canonical `event_type` values: `ChargeScheduled`, `ChargeAttemptStarted`, `ChargeSucceeded`, `ChargeFailed`, `ChargePermanentlyFailed`, `ManualPaymentInitiated`, `RefundRequested`, `RefundConfirmed`, `ServiceAutoCancelled`, `ProviderCredentialed`, `WebhookReceived`, `CardTokenized`, `ServiceExecuted`, `ServiceCompleted`, `ChargeInAnalysis`.
- `aggregate_type` values: `'payment_schedule'`, `'payment_token'`, `'provider_account'`.
- `payload` JSONB includes: `service_id`, `schedule_id`, `from_state`, `to_state`, `failure_code`, `charge_amount`, `gateway_slug`.

**Deliverables:**
- Migration: `20260624000012_create_payment_events.sql`
- Event type catalog documentation.

**Dependencies:**
- Task 8 (`payment_schedules`).

**Runtime Guarantees:**
- Append-only semantics by convention.
- Published atomically with state transitions (same TX).

**Failure Handling:**
- If event INSERT fails: it is non-fatal; state commit proceeds; log WARN; downstream consumers use reconciliation to recover.

**Observability:**
- Analytics derivation: `approval_rate = COUNT(event_type='ChargeSucceeded') / COUNT(event_type='ChargeAttemptStarted')`.
- Refund rate, failure rate by code — all derivable from this table.

**Security Considerations:**
- `payload` MUST NOT contain raw card data or PII.

**Performance Considerations:**
- Three separate indexes support different query patterns without over-indexing.

**Requirements covered:** 30
**Acceptance Criteria covered:** 30A.1, 30A.3

---

### 13. [ ] Create `payment_webhook_processing_queue` Table

**Description:**
Create the heavy-processing webhook queue table. When a webhook event requires complex state reconciliation that exceeds the Edge Function response time budget, the event is enqueued here for asynchronous processing by the `process-webhook-retry` cron worker. This pattern prevents gateway timeout (NetCred requires HTTP 200 within seconds).

**Responsibilities:**
- Create table for async webhook processing offload.
- Link to `payment_webhook_events` via FK.
- Create scheduling index for cron dequeue.

**Implementation Details:**
```sql
CREATE TABLE payment_webhook_processing_queue (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_event_id TEXT       NOT NULL REFERENCES payment_webhook_events(id),
  gateway_slug    TEXT        NOT NULL,
  event_type      TEXT        NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempted_at    TIMESTAMPTZ,
  state           TEXT        NOT NULL DEFAULT 'PENDING'
                  CHECK (state IN ('PENDING','PROCESSING','PROCESSED','FAILED')),
  attempt_count   SMALLINT    NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_queue_state
  ON payment_webhook_processing_queue(state, scheduled_at)
  WHERE state = 'PENDING';
```
- This queue SHOULD be used only for webhook events that require calling `getTransaction` or performing multi-step reconciliation.
- Standard webhook events (TRANSACTION_CAPTURE, TRANSACTION_REFUND) SHOULD be processed inline if DB latency permits.

**Deliverables:**
- Migration: `20260624000013_create_webhook_processing_queue.sql`
- Queue dequeue index SQL.

**Dependencies:**
- Task 10 (`payment_webhook_events`).

**Runtime Guarantees:**
- FK to `payment_webhook_events` prevents orphaned queue entries.
- `PENDING` partial index ensures cron sees only actionable records.

**Failure Handling:**
- Failed queue item: `state = 'FAILED'`; escalated to CRITICAL if persistent.

**Observability:**
- `scheduled_at - attempted_at` = processing delay metric.

**Security Considerations:**
- `service_role` only; no client access.

**Performance Considerations:**
- Partial index on `state = 'PENDING'` keeps dequeue fast.

**Requirements covered:** 16, 17
**Acceptance Criteria covered:** 16A.5

---

## Phase 2: Persistence Layer — RLS and Permission Enforcement

---

### 14. [ ] Implement `payment_schedules` State Machine AFTER UPDATE Trigger

**Description:**
Implement an AFTER UPDATE trigger on `payment_schedules` that validates state machine transitions. The trigger enforces that state changes follow the permitted transition graph defined in design §2.3. This is a defense-in-depth control supplementing the CHECK constraint — it prevents invalid state regressions even if application logic has a bug.

**Responsibilities:**
- Define the permitted transition adjacency list.
- Implement `validate_payment_schedule_transition()` trigger function.
- Register AFTER UPDATE trigger on `payment_schedules`.
- Allow `service_role` bypass for emergency ops.

**Implementation Details:**
```sql
CREATE OR REPLACE FUNCTION validate_payment_schedule_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  allowed_transitions JSONB := '{
    "SCHEDULED":        ["PROCESSING","CANCELLED"],
    "PROCESSING":       ["PAID","IN_ANALYSIS","FAILED","FAILED_PERMANENT","SCHEDULED"],
    "FAILED":           ["PROCESSING","CANCELLED"],
    "FAILED_PERMANENT": ["PROCESSING","CANCELLED"],
    "IN_ANALYSIS":      ["PAID","FAILED_PERMANENT"],
    "PAID":             ["REFUND_REQUESTED","VOIDED"],
    "REFUND_REQUESTED": ["REFUNDED","PARTIALLY_REFUNDED"],
    "REFUNDED":         [],
    "PARTIALLY_REFUNDED":[],
    "CANCELLED":        [],
    "VOIDED":           [],
    "EXPIRED":          []
  }';
  valid_targets TEXT[];
BEGIN
  IF OLD.state = NEW.state THEN RETURN NEW; END IF;
  valid_targets := ARRAY(
    SELECT jsonb_array_elements_text(allowed_transitions->OLD.state)
  );
  IF NOT (NEW.state = ANY(valid_targets)) THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: % -> %', OLD.state, NEW.state
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trig_validate_payment_schedule_state
  BEFORE UPDATE OF state ON payment_schedules
  FOR EACH ROW EXECUTE FUNCTION validate_payment_schedule_transition();
```
- The transition from `PROCESSING → SCHEDULED` (janitor recovery when `attempt_count = 0`) MUST be explicitly in the allowed list.
- Janitor RPC (Task 21) is called via `service_role` — trigger fires regardless of caller role.

**Deliverables:**
- Migration: `20260624000014_payment_schedule_state_trigger.sql`
- Trigger function SQL.
- Transition adjacency list documentation.

**Dependencies:**
- Task 8 (`payment_schedules`).

**Runtime Guarantees:**
- Invalid transitions raise DB exception, rolling back the enclosing TX.
- Transition graph enforced at DB level, not just application level.

**Failure Handling:**
- Invalid transition: `P0001` exception; enclosing TX rolled back.
- Emergency ops override: `ALTER TABLE ... DISABLE TRIGGER` for maintenance windows (ops procedure).

**Observability:**
- Trigger violations logged by PostgreSQL error log.

**Security Considerations:**
- Defense-in-depth against application state machine bugs.

**Performance Considerations:**
- BEFORE UPDATE trigger fires only on `state` column change (reduced trigger overhead via `UPDATE OF state`).

**Requirements covered:** 23, 26
**Acceptance Criteria covered:** 23A.1, 23A.5

---

### 15. [ ] Configure RLS on `payment_schedules` and `provider_accounts`

**Description:**
Enable Row Level Security on `payment_schedules` and `provider_accounts` tables with policies ensuring clients and providers access only their own records. State transitions MUST be performed via `SECURITY DEFINER` RPCs, not direct UPDATE via `authenticated` role.

**Responsibilities:**
- Enable RLS on `payment_schedules`.
- Client can SELECT where `auth.uid() = client_id`.
- Provider can SELECT where `auth.uid() = provider_id`.
- No authenticated UPDATE/DELETE on `payment_schedules` (RPC-only writes).
- Enable RLS on `provider_accounts`.
- Provider can SELECT own account only.

**Implementation Details:**
```sql
ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_schedules_client_select"
  ON payment_schedules FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "payment_schedules_provider_select"
  ON payment_schedules FOR SELECT
  USING (auth.uid() = provider_id);

REVOKE INSERT, UPDATE, DELETE ON payment_schedules FROM authenticated;
GRANT SELECT ON payment_schedules TO authenticated;

ALTER TABLE provider_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_accounts_owner_select"
  ON provider_accounts FOR SELECT
  USING (auth.uid() = provider_user_id);

REVOKE INSERT, UPDATE, DELETE ON provider_accounts FROM authenticated;
```
- All write paths go through `SECURITY DEFINER` RPCs (Tasks 20-25).
- `service_role` bypasses RLS by default (Supabase behavior).

**Deliverables:**
- Migration: `20260624000015_rls_payment_schedules_provider_accounts.sql`
- RLS policy SQL.

**Dependencies:**
- Tasks 8, 6.

**Runtime Guarantees:**
- Cross-user data leakage structurally prevented.
- Write-only via SECURITY DEFINER RPCs.

**Security Considerations:**
- RLS policies use `auth.uid()` which is validated by Supabase JWT middleware.
- `service_role` bypass is intentional for cron/EF paths.

**Requirements covered:** 24, 29
**Acceptance Criteria covered:** 24A.6, 29A.1

---

### 16. [ ] Configure RLS on `payment_audit_log`, `payment_events`, `payment_gateway_tokens`

**Description:**
Configure remaining table-level security. `payment_audit_log` allows clients and providers to read their own service history. `payment_events` is service_role-only. `payment_gateway_tokens` is service_role-only with full READ/WRITE restriction for `authenticated`.

**Responsibilities:**
- `payment_audit_log` RLS: client/provider can SELECT where service_id matches their contracted services.
- `payment_events`: no client access; analytics queries via service_role.
- `payment_gateway_tokens`: service_role only.

**Implementation Details:**
```sql
ALTER TABLE payment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_client_select"
  ON payment_audit_log FOR SELECT
  USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM payment_schedules ps
      WHERE ps.id = payment_audit_log.schedule_id
        AND (ps.client_id = auth.uid() OR ps.provider_id = auth.uid())
    )
  );

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
-- No authenticated access; analytics via service_role
REVOKE ALL ON payment_events FROM authenticated;

ALTER TABLE payment_gateway_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_gateway_tokens FROM authenticated;
REVOKE ALL ON payment_gateway_tokens FROM anon;
```

**Deliverables:**
- Migration: `20260624000016_rls_audit_events_gateway.sql`

**Dependencies:**
- Tasks 11, 12, 3.

**Runtime Guarantees:**
- Audit log accessible to relevant parties for dispute resolution.
- Gateway tokens inaccessible to any client path.

**Security Considerations:**
- Subquery in audit RLS policy may be performance-sensitive; consider denormalization of `client_id` into `payment_audit_log` if needed.

**Requirements covered:** 22, 24
**Acceptance Criteria covered:** 22A.4, 24A.6

---

## Phase 3: PostgreSQL Transactional Logic (RPCs)

---

### 17. [ ] Implement `calculate_charge_amount()` PostgreSQL RPC

**Description:**
Implement the `calculate_charge_amount()` stored function that computes the final charge amount using the SAME formula as the `calculate-installment-options` Edge Function, but reading `platform_constants` live at RPC execution time. This is the authoritative amount computation for the cron — it MUST NOT use the HMAC payload or any cached amount from checkout.

**Responsibilities:**
- Accept `payment_token_id`, `base_amount`, `installment_number` as parameters.
- Read `card_brand` from `payment_tokens` table.
- Read all rate values from `platform_constants`.
- Apply brand/range resolution logic.
- Apply banker's rounding (ROUND_HALF_EVEN) to `installment_amount`.
- Return `charge_amount` as `NUMERIC(12,2)`.
- Handle missing platform_constants keys with safe defaults.

**Implementation Details:**
```sql
CREATE OR REPLACE FUNCTION calculate_charge_amount(
  p_token_id         UUID,
  p_base_amount      NUMERIC(12,2),
  p_installment_n    SMALLINT
) RETURNS NUMERIC(12,2)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_brand           TEXT;
  v_rate_key        TEXT;
  v_rate            NUMERIC;
  v_fixed_fee       NUMERIC;
  v_total_with_fees NUMERIC;
  v_charge_amount   NUMERIC(12,2);
BEGIN
  SELECT card_brand INTO v_brand FROM payment_tokens WHERE id = p_token_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOKEN_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- Brand/range key resolution
  v_rate_key := CASE
    WHEN v_brand IN ('VCC','MASTER') AND p_installment_n = 1      THEN 'cc_visa_master_1x_rate'
    WHEN v_brand IN ('VCC','MASTER') AND p_installment_n BETWEEN 2 AND 6  THEN 'cc_visa_master_2_6x_rate'
    WHEN v_brand IN ('VCC','MASTER') AND p_installment_n BETWEEN 7 AND 12 THEN 'cc_visa_master_7_12x_rate'
    WHEN p_installment_n = 1       THEN 'cc_elo_other_1x_rate'
    WHEN p_installment_n BETWEEN 2 AND 6  THEN 'cc_elo_other_2_6x_rate'
    WHEN p_installment_n BETWEEN 7 AND 12 THEN 'cc_elo_other_7_12x_rate'
    ELSE 'cc_elo_other_1x_rate'
  END;

  SELECT value::NUMERIC INTO v_rate FROM platform_constants WHERE key = v_rate_key;
  v_rate := COALESCE(v_rate, 2.69); -- safe default

  SELECT value::NUMERIC INTO v_fixed_fee FROM platform_constants WHERE key = 'cc_fixed_processing_fee_brl';
  v_fixed_fee := COALESCE(v_fixed_fee, 0.39);

  v_total_with_fees := (p_base_amount * (1 + v_rate / 100)) + v_fixed_fee;
  v_charge_amount := ROUND(v_total_with_fees / p_installment_n, 2);

  RETURN v_charge_amount;
END;
$$;
```
- This function MUST be called by `schedule-netcred-charges` and `manual-charge-payment` EFs — never compute charge_amount in application code.
- Formula MUST be identical to the Edge Function computation (Req 7 AC6).
- `SECURITY DEFINER` allows EFs with `service_role` to call it without exposing `payment_tokens` data.

**Deliverables:**
- Migration: `20260624000017_rpc_calculate_charge_amount.sql`
- Unit test: fee formula correctness for all brand/range combinations.
- Unit test: COALESCE fallback on missing constants.

**Dependencies:**
- Tasks 4 (`platform_constants`), 5 (`payment_tokens`).

**Runtime Guarantees:**
- Always uses CURRENT `platform_constants` at execution time.
- COALESCE prevents NULL propagation on missing constants.
- `SECURITY DEFINER` ensures safe access to `payment_tokens` card_brand.

**Failure Handling:**
- `TOKEN_NOT_FOUND`: propagated as exception; EF catches and marks schedule `FAILED`.
- `platform_constants` missing: COALESCE to hardcoded default; WARN log in calling EF.

**Observability:**
- RPC execution appears in `pg_stat_statements` for latency monitoring.

**Security Considerations:**
- SECURITY DEFINER: function runs as owner; EF cannot directly read `payment_tokens` without RLS bypass.

**Performance Considerations:**
- Two single-row reads from small tables; negligible overhead.

**Requirements covered:** 7, 10, 25
**Acceptance Criteria covered:** 7A.5, 7A.6, 10A.3, 25A.5

---

### 18. [ ] Implement `accept_proposal_rpc()` — Atomic Acceptance Orchestration

**Description:**
Implement the atomic `accept_proposal_rpc()` function that creates the contracted service and payment schedule in a single database transaction. This RPC is called by the `accept-proposal` Edge Function AFTER all pre-validation (HMAC, pricing_signature, token state, provider credentialing) passes. The UNIQUE constraint on `idempotency_key` is the retry safety mechanism.

**MANDATORY: `rpc_idempotency_records` integration.** The workspace rule `rpc-idempotency-records.mdc` requires all `SECURITY DEFINER` RPCs with multi-step mutations to use `idempotency_begin` / `idempotency_commit`. `accept_proposal_rpc` creates 3 rows across 3 tables in one TX — it is the canonical example of this pattern and `chats.accept_proposal` is already listed in the operations table. This RPC MUST integrate both mechanisms: (a) the `rpc_idempotency_records` table for network-level replay safety (same JSON response on retry), and (b) the `payment_schedules.idempotency_key` UNIQUE constraint for DB-level conflict detection.

**Responsibilities:**
- Accept all acceptance parameters, including `p_idempotency_key UUID NOT NULL`.
- Call `idempotency_begin('payments.accept_proposal', p_idempotency_key, request_hash)` at RPC entry. Return cached response if non-NULL.
- Create `contracted_services` record with `status = 'PENDING_PAYMENT'` and `service_scheduled_at`.
- Create `payment_schedules` record with `state = 'SCHEDULED'`.
- Compute `charge_scheduled_at = service_scheduled_at - interval '2 days'` (or `now()` for emergency).
- Set `idempotency_key = contracted_service_id`.
- INSERT `payment_audit_log` entries: `CHARGE_SCHEDULED` and `PAYMENT_TERMS_ACCEPTED`.
- INSERT `payment_events`: `ChargeScheduled`.
- Call `idempotency_commit(...)` with the final response JSON before returning.
- Handle `idempotency_key` conflict idempotently (DB-level UNIQUE violation → return existing IDs).

**Implementation Details:**
```sql
CREATE OR REPLACE FUNCTION accept_proposal_rpc(
  p_proposal_id           UUID,
  p_client_id             UUID,
  p_provider_id           UUID,
  p_gateway_slug          TEXT,
  p_payment_token_id      UUID,
  p_installment_number    SMALLINT,
  p_base_amount           NUMERIC(12,2),
  p_service_scheduled_at  TIMESTAMPTZ,
  p_clearsale_session_id  TEXT,
  p_client_ip_address     TEXT,
  p_actor_id              UUID,
  p_idempotency_key       UUID NOT NULL  -- client-generated UUID v7 per rpc_idempotency_records rule
) RETURNS TABLE(contracted_service_id UUID, schedule_id UUID, is_idempotent BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_service_id     UUID;
  v_schedule_id    UUID;
  v_charge_at      TIMESTAMPTZ;
  v_emergency      BOOLEAN := FALSE;
  v_request_hash   TEXT;
  v_cached         JSONB;
  v_response       JSONB;
BEGIN
  -- rpc_idempotency_records: compute request hash and check cache
  v_request_hash := md5(concat_ws('|', p_proposal_id, p_client_id, p_payment_token_id,
                                       p_installment_number, p_base_amount::text));
  v_cached := public.idempotency_begin_for_actor(
    p_actor_id, 'payments.accept_proposal', p_idempotency_key, v_request_hash
  );
  IF v_cached IS NOT NULL THEN
    -- Replay: return cached response without re-executing mutations
    RETURN QUERY SELECT
      (v_cached->>'contracted_service_id')::UUID,
      (v_cached->>'schedule_id')::UUID,
      TRUE;
    RETURN;
  END IF;

  -- Compute charge_scheduled_at
  IF p_service_scheduled_at - now() < interval '48 hours' THEN
    v_charge_at := now();
    v_emergency := TRUE;
  ELSE
    v_charge_at := p_service_scheduled_at - interval '2 days';
  END IF;

  -- DB-level idempotency: try INSERT contracted_services
  BEGIN
    INSERT INTO contracted_services (
      proposal_id, client_id, provider_id, status, service_scheduled_at
    ) VALUES (
      p_proposal_id, p_client_id, p_provider_id, 'PENDING_PAYMENT', p_service_scheduled_at
    ) RETURNING id INTO v_service_id;
  EXCEPTION WHEN unique_violation THEN
    -- Accept_proposal DB-level retry: return existing (also commit to idempotency cache)
    SELECT cs.id, ps.id INTO v_service_id, v_schedule_id
    FROM contracted_services cs
    JOIN payment_schedules ps ON ps.contracted_service_id = cs.id
    WHERE cs.proposal_id = p_proposal_id AND cs.client_id = p_client_id;
    v_response := jsonb_build_object('contracted_service_id', v_service_id, 'schedule_id', v_schedule_id);
    PERFORM public.idempotency_commit_for_actor(
      p_actor_id, 'payments.accept_proposal', p_idempotency_key, v_request_hash, 200, v_response
    );
    RETURN QUERY SELECT v_service_id, v_schedule_id, TRUE;
    RETURN;
  END;

  INSERT INTO payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    payment_token_id, installment_number, base_amount,
    charge_scheduled_at, state, idempotency_key,
    clearsale_session_id, client_ip_address, max_attempts
  ) VALUES (
    v_service_id, p_client_id, p_provider_id, p_gateway_slug,
    p_payment_token_id, p_installment_number, p_base_amount,
    v_charge_at, 'SCHEDULED', v_service_id::TEXT,
    p_clearsale_session_id, p_client_ip_address,
    (SELECT value::SMALLINT FROM platform_constants WHERE key='max_charge_attempts')
  ) RETURNING id INTO v_schedule_id;

  INSERT INTO payment_audit_log (event_type, entity_type, entity_id, service_id, schedule_id, actor, actor_id, metadata)
  VALUES
    ('CHARGE_SCHEDULED', 'payment_schedule', v_schedule_id, v_service_id, v_schedule_id, 'client', p_actor_id,
     jsonb_build_object('charge_scheduled_at', v_charge_at, 'emergency_scheduling', v_emergency,
                        'installment_number', p_installment_number, 'base_amount', p_base_amount)),
    ('PAYMENT_TERMS_ACCEPTED', 'payment_schedule', v_schedule_id, v_service_id, v_schedule_id, 'client', p_actor_id,
     jsonb_build_object('gateway_slug', p_gateway_slug, 'accepted_at', now()));

  INSERT INTO payment_events (event_type, aggregate_type, aggregate_id, service_id, payload)
  VALUES ('ChargeScheduled', 'payment_schedule', v_schedule_id, v_service_id,
          jsonb_build_object('charge_scheduled_at', v_charge_at, 'gateway_slug', p_gateway_slug));

  -- Commit to rpc_idempotency_records cache so next retry gets the same response
  v_response := jsonb_build_object('contracted_service_id', v_service_id, 'schedule_id', v_schedule_id);
  PERFORM public.idempotency_commit_for_actor(
    p_actor_id, 'payments.accept_proposal', p_idempotency_key, v_request_hash, 200, v_response
  );

  RETURN QUERY SELECT v_service_id, v_schedule_id, FALSE;
END;
$$;
```
- All 3 INSERTs are atomic within one PG transaction.
- `idempotency_key = contracted_service_id` (UUID → TEXT cast) prevents duplicate schedules.
- Emergency scheduling sets `metadata.emergency_scheduling = true` per Req 8 AC4.
- `idempotency_begin_for_actor` / `idempotency_commit_for_actor` used (not `auth.uid()`-based helpers) because the EF calls this RPC as `service_role`; the actor is `p_actor_id` (the client's JWT `sub`).
- The operation string `'payments.accept_proposal'` MUST be added to the `rpc_idempotency_records` operations table (workspace rule §Current operations).

**Deliverables:**
- Migration: `20260624000018_rpc_accept_proposal.sql`
- Integration test: idempotent retry (same `p_idempotency_key`) returns cached JSON without re-inserting.
- Integration test: hash mismatch on retry → `IDEMPOTENCY_CONFLICT` raised.
- Integration test: emergency scheduling sets charge_at = now().

**Dependencies:**
- Tasks 8, 11, 12, 4, 83 (contracted_services schema extension).

**Runtime Guarantees:**
- Atomic: all 3 INSERTs commit or none do.
- Idempotent at two levels: `rpc_idempotency_records` (network replay) + `payment_schedules.idempotency_key` UNIQUE (DB-level dedup).
- `charge_scheduled_at` computed at DB time (not application time) for consistency.

**Failure Handling:**
- `unique_violation` on `contracted_services`: idempotent path returns existing record.
- `unique_violation` on `payment_schedules.idempotency_key`: secondary dedup guard.

**Observability:**
- `emergency_scheduling` flag in audit log metadata.

**Security Considerations:**
- SECURITY DEFINER: validates `provider_id` credentialing in EF before calling this RPC.

**Requirements covered:** 8, 9, 22
**Acceptance Criteria covered:** 8A.2, 8A.4, 8A.7, 9A.1, 22A.1, 22A.3

---

### 19. [ ] Implement `recover_orphaned_payment_schedules()` — Janitor RPC

**Description:**
Implement the orphan recovery janitor RPC that detects and recovers payment schedule records stuck in `PROCESSING` state with an expired `locked_until` lease. This is the primary fault-tolerance mechanism for Edge Function crashes or network timeouts. MUST be invoked every 30 minutes by pg_cron.

**Responsibilities:**
- Detect `PROCESSING` records where `locked_until < now()`.
- Transition `automatic_attempt_count = 0` → `SCHEDULED`.
- Transition `automatic_attempt_count > 0` → `FAILED` with `next_retry_at = now() + 30min`.
- Set `locked_until = NULL` unconditionally.
- INSERT `payment_audit_log` entry `ORPHAN_RECOVERED` for each recovered record.
- INSERT `payment_events` entry for recovered records.
- Use exact SQL from design §4.6.

**Implementation Details:**
```sql
CREATE OR REPLACE FUNCTION recover_orphaned_payment_schedules()
RETURNS TABLE(recovered_count INT, recovered_to_scheduled INT, recovered_to_failed INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row    payment_schedules%ROWTYPE;
  v_count  INT := 0;
  v_sched  INT := 0;
  v_fail   INT := 0;
  v_new_state TEXT;
BEGIN
  FOR v_row IN (
    SELECT * FROM payment_schedules
    WHERE state = 'PROCESSING'
      AND locked_until < now()
    FOR UPDATE SKIP LOCKED
  ) LOOP
    v_new_state := CASE
      WHEN v_row.automatic_attempt_count = 0 THEN 'SCHEDULED'
      ELSE 'FAILED'
    END;

    UPDATE payment_schedules SET
      state        = v_new_state,
      locked_until = NULL,
      next_retry_at = CASE
        WHEN v_row.automatic_attempt_count > 0
        THEN now() + (SELECT value::int FROM platform_constants WHERE key='charge_retry_interval_minutes') * interval '1 minute'
        ELSE NULL
      END,
      updated_at = now()
    WHERE id = v_row.id;

    INSERT INTO payment_audit_log (
      event_type, entity_type, entity_id, service_id, schedule_id,
      from_state, to_state, actor, metadata
    ) VALUES (
      'ORPHAN_RECOVERED', 'payment_schedule', v_row.id,
      v_row.contracted_service_id, v_row.id,
      'PROCESSING', v_new_state, 'system',
      jsonb_build_object(
        'recovered_at', now(),
        'locked_until_was', v_row.locked_until,
        'automatic_attempt_count', v_row.automatic_attempt_count
      )
    );

    v_count := v_count + 1;
    IF v_new_state = 'SCHEDULED' THEN v_sched := v_sched + 1;
    ELSE v_fail := v_fail + 1; END IF;
  END LOOP;

  RETURN QUERY SELECT v_count, v_sched, v_fail;
END;
$$;
```
- Uses `FOR UPDATE SKIP LOCKED` to prevent concurrent janitor invocations from recovering the same record.
- Returns recovery statistics for Sentry INFO logging.
- `next_retry_at` reads `charge_retry_interval_minutes` from `platform_constants` at recovery time.

**Deliverables:**
- Migration: `20260624000019_rpc_recover_orphaned_schedules.sql`
- Unit test: `attempt_count=0` → SCHEDULED.
- Unit test: `attempt_count>0` → FAILED with next_retry_at set.

**Dependencies:**
- Tasks 8, 11, 4.

**Runtime Guarantees:**
- `FOR UPDATE SKIP LOCKED` prevents double recovery.
- Idempotent: records already recovered are no longer in `PROCESSING`.
- Returns recovery counts for operational visibility.

**Failure Handling:**
- If a row fails to update: per-row exception isolation via EXCEPTION block (future enhancement).
- Network timeout: janitor runs again in 30min.

**Observability:**
- `ORPHAN_RECOVERED` event in audit log.
- Recovery count emitted as Sentry INFO breadcrumb by invoking EF.

**Security Considerations:**
- SECURITY DEFINER: janitor needs `service_role`-level access.

**Requirements covered:** 23, 11
**Acceptance Criteria covered:** 23A.2, 11A.1

---

### 20. [ ] Implement `auto_cancel_services_rpc()` — T-12h Auto-Cancellation

**Description:**
Implement the `auto_cancel_services_rpc()` procedure that cancels all contracted services with unresolved payment failures within 12 hours of their scheduled execution. Per-service error isolation is mandatory — a failure on one service MUST NOT abort processing of others. `IN_ANALYSIS` records MUST be excluded from auto-cancellation.

**Responsibilities:**
- Select services matching T-12h criteria.
- Exclude `IN_ANALYSIS`, `PAID`, `CANCELLED`, `COMPLETED` states.
- Atomically cancel `contracted_services` and `payment_schedules` per service.
- Set `cancellation_reason = 'NON_PAYMENT'` or `'PROVIDER_SUSPENDED'`.
- INSERT `payment_audit_log` entry per cancelled service.
- INSERT `payment_events` entry per cancelled service.
- Implement per-service `EXCEPTION` block for error isolation.
- Idempotency: skip already-cancelled services.

**Implementation Details:**
Based on design §4.12 — see the exact `auto_cancel_services_rpc()` SQL in design §4.12. Key details:
- WHERE clause: `cs.service_scheduled_at - now() <= interval '12 hours'` AND `ps.state NOT IN ('PAID','IN_ANALYSIS','CANCELLED','VOIDED','REFUNDED','PARTIALLY_REFUNDED','EXPIRED')` AND `cs.status NOT IN ('CANCELLED','COMPLETED')`.
- Per-service BEGIN/EXCEPTION WHEN OTHERS: `PERFORM pg_notify('auto_cancel_error', v_service.service_id::text)`.
- `cancellation_reason`: `'PROVIDER_SUSPENDED'` when `provider_accounts.onboarding_status = 'SUSPENDED'`; otherwise `'NON_PAYMENT'`.
- Idempotency: check `contracted_services.status = 'CANCELLED'` at start of each loop iteration.

**Deliverables:**
- Migration: `20260624000020_rpc_auto_cancel_services.sql`
- Integration test: `IN_ANALYSIS` records skipped.
- Integration test: already-cancelled records skipped (idempotent).
- Integration test: `PROVIDER_SUSPENDED` cancellation reason set correctly.

**Dependencies:**
- Tasks 8, 11, 6.

**Runtime Guarantees:**
- Per-service error isolation prevents batch abort.
- Idempotency: CONTINUE on already-cancelled.
- `IN_ANALYSIS` exemption: structurally enforced in WHERE clause.

**Failure Handling:**
- Per-service exception: `pg_notify` emitted; continues to next service.
- Notification failures: enqueuing is separate; handled by dispatcher.

**Observability:**
- `AUTO_CANCELLED` event in audit log per service.
- `pg_notify` on error for real-time alerting.

**Security Considerations:**
- SECURITY DEFINER: called by cron via service_role.

**Requirements covered:** 14
**Acceptance Criteria covered:** 14A.1, 14A.2, 14A.4, 14A.6, 14A.7

---

### 21. [ ] Implement `mark_service_executed()` RPC — Provider Execution Mark

**Description:**
Implement the provider-callable RPC for marking a service as executed. The RPC MUST validate that the service is in `CONFIRMED` status and that `scheduled_date::date <= CURRENT_DATE` (date-only comparison, no time component). These guards prevent providers from pre-emptively marking future services as completed.

**Responsibilities:**
- Validate `contracted_services.status = 'CONFIRMED'`.
- Validate `scheduled_date::date <= CURRENT_DATE`.
- Transition `status = 'EXECUTED'`, `executed_at = now()`.
- INSERT `payment_audit_log` entry `SERVICE_EXECUTED`.
- Enqueue Push notification to client (via dispatcher).

**Implementation Details:**
```sql
CREATE OR REPLACE FUNCTION mark_service_executed(p_service_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cs contracted_services%ROWTYPE;
BEGIN
  SELECT * INTO v_cs FROM contracted_services
  WHERE id = p_service_id
    AND provider_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND_OR_UNAUTHORIZED' USING ERRCODE = 'P0003';
  END IF;

  IF v_cs.status != 'CONFIRMED' THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION' USING ERRCODE = 'P0001';
  END IF;

  IF v_cs.scheduled_date::date > CURRENT_DATE THEN
    RAISE EXCEPTION 'SERVICE_NOT_YET_DUE' USING ERRCODE = 'P0002';
  END IF;

  UPDATE contracted_services
  SET status = 'EXECUTED', executed_at = now()
  WHERE id = p_service_id;

  INSERT INTO payment_audit_log (event_type, entity_type, entity_id, service_id, actor, actor_id)
  VALUES ('SERVICE_EXECUTED', 'contracted_service', p_service_id, p_service_id, 'provider', auth.uid());

  INSERT INTO payment_events (event_type, aggregate_type, aggregate_id, service_id)
  VALUES ('ServiceExecuted', 'contracted_service', p_service_id, p_service_id);
END;
$$;
```
- `FOR UPDATE` on `contracted_services` prevents race conditions with concurrent completion.
- `scheduled_date::date` comparison is date-only (no time component per Req 32 AC1).
- Push notification enqueueing is done in the calling EF AFTER the TX commits.

**Deliverables:**
- Migration: `20260624000021_rpc_mark_service_executed.sql`
- Test: scheduled_date in future → `SERVICE_NOT_YET_DUE` error.
- Test: status != CONFIRMED → `INVALID_STATUS_TRANSITION` error.

**Dependencies:**
- Tasks 11, 12.
- `contracted_services` table.

**Runtime Guarantees:**
- `FOR UPDATE` prevents concurrent executed-marking.
- Date-only comparison prevents time-of-day exploitation.

**Failure Handling:**
- Invalid status: ERRCODE P0001; EF returns HTTP 409.
- Future date: ERRCODE P0002; EF returns HTTP 409.

**Security Considerations:**
- `auth.uid()` check in WHERE ensures provider-only execution.
- RPC validates authorization at DB level.

**Requirements covered:** 32
**Acceptance Criteria covered:** 32A.1, 32A.5

---

### 22. [ ] Implement `match_provider_jobs()` Credentialing Gate RPC + Chat Initiation Denial

**Description:**
Extend or create the `match_provider_jobs()` RPC to enforce the `onboarding_status = 'ACTIVE'` gate. A provider with any other `onboarding_status` (including `SUSPENDED`) MUST receive an empty result set. This enforcement MUST be in the RPC at the PostgreSQL level, not only in client-side rendering. Additionally, the chat initiation RPC MUST be patched to raise `PROVIDER_NOT_CREDENTIALED` for non-ACTIVE providers (Req 3 AC7, Req 29 AC2).

**Responsibilities:**
- Add `onboarding_status` guard to `match_provider_jobs` RPC.
- Return empty result set for non-ACTIVE providers.
- Use SECURITY DEFINER to enforce the gate regardless of caller.
- Document the guard pattern for chat initiation and proposal RPCs.

**Implementation Details:**
```sql
-- Guard to be added at the start of match_provider_jobs()
IF (
  SELECT onboarding_status FROM provider_accounts
  WHERE provider_user_id = auth.uid()
    AND gateway_slug = 'netcred'
) IS DISTINCT FROM 'ACTIVE' THEN
  RETURN; -- empty result set
END IF;
```
- The same guard pattern MUST be applied to:
  - Chat initiation RPC (add `error_code: 'PROVIDER_NOT_CREDENTIALED'` RAISE).
  - `accept_proposal` pre-validation (provider side).
  - Any other opportunity-listing or job-matching RPC.
- `SUSPENDED` status is treated identically to `PENDING_DOCUMENTS` for access denial.

**Deliverables:**
- Migration: `20260624000022_rpc_match_provider_jobs_gate.sql`
- Integration test: ACTIVE provider sees opportunities.
- Integration test: PENDING_DOCUMENTS provider sees empty set.
- Integration test: SUSPENDED provider sees empty set.

**Dependencies:**
- Task 6 (`provider_accounts`).

**Runtime Guarantees:**
- Gate executes at DB level (SECURITY DEFINER RPC).
- Empty result semantics: no error, just empty rows.

**Security Considerations:**
- `auth.uid()` references are server-side (cannot be forged by client).
- SECURITY DEFINER ensures gate cannot be bypassed by caller role.

**Requirements covered:** 3, 29
**Acceptance Criteria covered:** 3A.6, 3A.7 (chat initiation denial → `PROVIDER_NOT_CREDENTIALED` RAISE applied to chat initiation RPC), 29A.1, 29A.2, 29A.5, 29A.6 (Req 29 AC6: charging MUST NOT auto-resume when a provider transitions from SUSPENDED→ACTIVE; reactivation via `detect-netcred-onboarding` only sets `onboarding_status = ACTIVE`; no cron restarts cancelled schedules — existing `CANCELLED` records remain terminal, no automatic resumption logic added)

---

### 23. [ ] Implement `reschedule_charge_date()` RPC

**Description:**
Implement the rescheduling integration RPC that recalculates `charge_scheduled_at` when a service is rescheduled. This RPC is called by the rescheduling subsystem (NOT the payment system). It updates `charge_scheduled_at` only when `payment_schedules.state ∈ {SCHEDULED, FAILED, IN_ANALYSIS}`. PAID schedules update `contracted_services.scheduled_at` for audit but do not trigger new charges.

**Responsibilities:**
- Receive `service_id` and `new_service_scheduled_at`.
- Read current `payment_schedules.state`.
- If `state ∈ {SCHEDULED, FAILED, IN_ANALYSIS}`: update `charge_scheduled_at = MAX(now(), new_service_scheduled_at - 2 days)`.
- Reset `upcoming_charge_notified_at = NULL` to enable new 24h notification.
- INSERT audit log `CHARGE_RESCHEDULED` with `old_charge_scheduled_at` and `new_charge_scheduled_at`.
- If `state = PAID`: update `contracted_services.scheduled_at` only; no schedule change.

**Implementation Details:**
```sql
CREATE OR REPLACE FUNCTION reschedule_charge_date(
  p_service_id             UUID,
  p_new_service_scheduled_at TIMESTAMPTZ
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ps     payment_schedules%ROWTYPE;
  v_new_charge_at TIMESTAMPTZ;
  v_emergency BOOLEAN;
BEGIN
  SELECT * INTO v_ps FROM payment_schedules
  WHERE contracted_service_id = p_service_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_ps.state = 'PAID' THEN
    UPDATE contracted_services SET scheduled_date = p_new_service_scheduled_at::DATE WHERE id = p_service_id;
    RETURN;
  END IF;

  IF v_ps.state NOT IN ('SCHEDULED','FAILED','IN_ANALYSIS') THEN RETURN; END IF;

  v_new_charge_at := GREATEST(now(), p_new_service_scheduled_at - interval '2 days');
  v_emergency := (p_new_service_scheduled_at - now() < interval '48 hours');

  UPDATE payment_schedules SET
    charge_scheduled_at = v_new_charge_at,
    upcoming_charge_notified_at = NULL,
    updated_at = now()
  WHERE id = v_ps.id;

  INSERT INTO payment_audit_log (event_type, entity_type, entity_id, service_id, schedule_id, actor, metadata)
  VALUES ('CHARGE_RESCHEDULED', 'payment_schedule', v_ps.id, p_service_id, v_ps.id, 'system',
    jsonb_build_object(
      'old_charge_scheduled_at', v_ps.charge_scheduled_at,
      'new_charge_scheduled_at', v_new_charge_at,
      'emergency_scheduling', v_emergency
    ));
END;
$$;
```

**Deliverables:**
- Migration: `20260624000023_rpc_reschedule_charge_date.sql`
- Test: `state=PAID` → only service date updated.
- Test: `state=SCHEDULED` → `charge_scheduled_at` updated and `upcoming_charge_notified_at` reset.

**Dependencies:**
- Tasks 8, 11.

**Runtime Guarantees:**
- `FOR UPDATE` on `payment_schedules` prevents concurrent charge execution during rescheduling.
- `upcoming_charge_notified_at = NULL` reset enables re-notification for new charge date.

**Requirements covered:** 9, 33
**Acceptance Criteria covered:** 9A.3, 9A.4, 33A.5

---

## Phase 4: Scheduling Engine (pg_cron)

---

### 24. [ ] Register All pg_cron Jobs

**Description:**
Register all 8 `pg_cron` scheduled jobs that drive the payment system's autonomous execution. Each job invokes a corresponding Edge Function via `net.http_post()` (pg_net) or a direct RPC call. Jobs MUST be registered with `active = false` initially, enabled only after the corresponding Edge Function passes smoke tests.

**Responsibilities:**
- Register all 8 cron jobs per design §6.1.
- Set UTC cron expressions (convert from UTC-3 to UTC).
- Register with `active = false` initially.
- Document the `pg_net` invocation pattern for EF calls.
- Implement `cron_<job_name>()` wrapper functions with `job_run_begin`/`job_run_finish` telemetry per `job-runs-cron-telemetry` workspace rule.
- Provide enable/disable procedures.

**Implementation Details:**

**MANDATORY: `job_runs` Telemetry Wrapper Pattern**

The workspace rule `job-runs-cron-telemetry.mdc` requires every product cron to record run telemetry via `job_run_begin` / `job_run_finish` / `job_run_abort_latest`. Each pg_cron job entry point MUST be a `cron_<job_name>()` `SECURITY DEFINER` function — NOT a direct EF HTTP call. The wrapper owns telemetry; the EF handles the actual logic. Example for the charge cron:

```sql
CREATE OR REPLACE FUNCTION public.cron_schedule_netcred_charges()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job_run_id UUID;
  v_started_at TIMESTAMPTZ := now();
BEGIN
  v_job_run_id := public.job_run_begin('schedule-netcred-charges', '1.0');
  BEGIN
    PERFORM net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/schedule-netcred-charges',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
    );
    PERFORM public.job_run_finish(v_job_run_id, v_started_at, 0, 0, 0, '{}'::jsonb, NULL);
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.job_run_abort_latest('schedule-netcred-charges', SQLERRM);
    RAISE;
  END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cron_schedule_netcred_charges() TO postgres;
```

This same pattern MUST be applied for ALL 8 cron jobs:
- `cron_schedule_netcred_charges()`
- `cron_auto_cancel_unpaid_services()`
- `cron_notify_upcoming_charges()`
- `cron_recover_payment_leases()` — calls `recover_orphaned_payment_schedules()` directly, wraps with `job_run_begin`/`job_run_finish`.
- `cron_reconcile_netcred_payments()`
- `cron_process_webhook_retry()`
- `cron_detect_netcred_onboarding()`
- `cron_auto_complete_executed_services()`

The pg_cron schedule calls the wrapper, not the EF URL directly:

```sql
-- T-2 Charge execution (06:00, 12:00, 18:00, 00:00 UTC-3 = 09:00, 15:00, 21:00, 03:00 UTC)
SELECT cron.schedule('schedule-netcred-charges', '0 9,15,21,3 * * *',
  $$SELECT public.cron_schedule_netcred_charges()$$);

-- Auto-cancellation (offset +15min from charge cron)
SELECT cron.schedule('auto-cancel-unpaid-services', '15 9,15,21,3 * * *',
  $$SELECT public.cron_auto_cancel_unpaid_services()$$);

-- Pre-charge notification (offset +30min)
SELECT cron.schedule('notify-upcoming-charges', '30 9,15,21,3 * * *',
  $$SELECT public.cron_notify_upcoming_charges()$$);

-- Orphan recovery janitor (every 30 minutes)
SELECT cron.schedule('recover-payment-leases', '*/30 * * * *',
  $$SELECT public.cron_recover_payment_leases()$$);

-- Reconciliation polling (every 30 minutes)
SELECT cron.schedule('reconcile-netcred-payments', '*/30 * * * *',
  $$SELECT public.cron_reconcile_netcred_payments()$$);

-- Webhook retry worker (every 5 minutes)
SELECT cron.schedule('process-webhook-retry', '*/5 * * * *',
  $$SELECT public.cron_process_webhook_retry()$$);

-- Onboarding detection (10:00 UTC daily)
SELECT cron.schedule('detect-netcred-onboarding', '0 10 * * *',
  $$SELECT public.cron_detect_netcred_onboarding()$$);

-- Auto-complete executed services (11:00 UTC daily)
SELECT cron.schedule('auto-complete-executed-services', '0 11 * * *',
  $$SELECT public.cron_auto_complete_executed_services()$$);

-- Initially disable all jobs; enable individually after smoke tests
UPDATE cron.job SET active = false
WHERE jobname IN (
  'schedule-netcred-charges','auto-cancel-unpaid-services','notify-upcoming-charges',
  'recover-payment-leases','reconcile-netcred-payments','process-webhook-retry',
  'detect-netcred-onboarding','auto-complete-executed-services'
);
```
- All 8 wrapper functions MUST be `GRANT EXECUTE TO postgres` only; never granted to `authenticated` or `anon`.
- `app.supabase_url` and `app.service_role_key` MUST be injected via `ALTER DATABASE ... SET` at provisioning time, NOT hardcoded.
- `job_runs` rows are pruned by the existing `cns_prune_job_runs` cron (90-day retention).

**Deliverables:**
- Migration: `20260624000024_register_pg_cron_jobs.sql`
- Enable/disable procedure SQL.
- pg_cron job schedule documentation.

**Dependencies:**
- Task 1 (pg_cron extension).
- All EF deployments (Tasks 33-49) must complete before enabling.

**Runtime Guarantees:**
- `active = false` ensures no premature execution.
- Each job is independent; one job failure does not affect others.

**Failure Handling:**
- pg_cron job failure is logged to `cron.job_run_details`.
- EF invocation failures are tracked by EF-level Sentry.

**Observability:**
- `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 100;` for execution history.

**Security Considerations:**
- `service_role_key` in job commands MUST be rotated if compromised.
- Consider pg_net vault secret injection for production hardening.

**Requirements covered:** 10, 14, 20, 23
**Acceptance Criteria covered:** 10A.1, 14A.1, 23A.1

---

## Phase 5: Shared Infrastructure — PaymentProvider Interface + NetCredAdapter

---

### 25. [ ] Define `PaymentProvider` TypeScript Interface

**Description:**
Define the `PaymentProvider` TypeScript interface and all related discriminated union types. This interface is the architectural boundary between business logic and gateway-specific implementations. No Edge Function business logic SHALL reference `NetCred`, GraphQL, or any gateway-specific type directly.

**Responsibilities:**
- Define `PaymentProvider` interface with all 8 methods.
- Define `CreateChargeInput` with `paymentMethod` discriminated union.
- Define `CreditCardCharge`, `PixCharge`, `BoletoCharge` sub-types.
- Define `PayoutRuleInput` for split configuration.
- Define all result types with error semantics.
- Export from `supabase/functions/_shared/payment/types.ts`.

**Implementation Details:**
```typescript
// supabase/functions/_shared/payment/types.ts

export interface PaymentProvider {
  tokenizeCard(input: TokenizeCardInput): Promise<TokenizeCardResult>;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  voidCharge(input: VoidChargeInput): Promise<VoidChargeResult>;
  refundTransaction(input: RefundTransactionInput): Promise<RefundTransactionResult>;
  getTransaction(input: GetTransactionInput): Promise<GetTransactionResult | null>;
  processWebhookEvent(input: ProcessWebhookInput): Promise<ProcessWebhookResult>;
  getProviderCredentials(document: string): Promise<ProviderCredentials | null>;
  refreshAuthToken(): Promise<void>;
}

export type CreateChargeInput = {
  referenceCode: string; // contracted_service_id UUID
  amount: Decimal;
  paymentMethod: CreditCardCharge | PixCharge | BoletoCharge;
  payoutRule: PayoutRuleInput;
  sessionId?: string;        // ClearSale sessionId
  customerIpAddress?: string;
};

export type CreditCardCharge = {
  type: 'CREDIT_CARD';
  installmentNumber: number;
  paymentProfileId: string;
  paymentToken: string;
};

export type PixCharge = {
  type: 'PIX';
  expiresAt: Date;
};

export type BoletoCharge = {
  type: 'BOLETO';
  dueDate: Date;
};

export type PayoutRuleInput = {
  providerAccount: { netcredCompanyId: string; netcredBankAccountId: string };
  ruleItems: Array<{
    type: 'FIXED_AMOUNT' | 'PERCENTAGE';
    receiver: 'provider' | 'platform';
    amount?: Decimal;
    percentage?: number;
    isLiable: boolean;
  }>;
};

export type CreateChargeResult = {
  success: boolean;
  transactionState?: 'PAID' | 'IN_ANALYSIS' | 'REJECTED' | 'VOIDED';
  chargeId?: string;
  transactionId?: string;
  error?: ChargeError;
};

export type RefundTransactionResult = {
  success: boolean;
  error?: RefundError;
};

export type RefundError = {
  code: 'ALREADY_REFUNDED' | 'TRANSACTION_NOT_FOUND' | 'INVALID_REFUND_AMOUNT' | 'UNKNOWN';
  message: string;
};

export type ChargeError = {
  code: 'TERMINAL' | 'RETRYABLE' | 'AUTH_FAILURE' | 'REFERENCE_CODE_CONFLICT';
  message: string;
  originalCode?: string;
};
```
- `referenceCode` MUST always be `contracted_service_id` UUID as string.
- `getTransaction` returning `null` means "no prior charge for this referenceCode".

**Deliverables:**
- `supabase/functions/_shared/payment/types.ts`
- All type definitions exported from `_shared/payment/index.ts`.

**Dependencies:**
- Task 1 (Deno runtime available in `_shared/`).

**Runtime Guarantees:**
- TypeScript interface compile-time enforcement.
- `getTransaction` null-return semantics explicitly typed.

**Security Considerations:**
- `RefundError.code: 'ALREADY_REFUNDED'` handled idempotently — no re-throw.

**Requirements covered:** 1
**Acceptance Criteria covered:** 1A.1, 1A.2, 1A.5, 1A.6, 1A.7

---

### 26. [ ] Implement `NetCredAdapter` — JWT Refresh with `FOR UPDATE` Serialization

**Description:**
Implement `NetCredAdapter.refreshAuthToken()` with the `SELECT FOR UPDATE` serialization pattern on `payment_gateway_tokens`. This method MUST be called before every API operation. The `FOR UPDATE` lock ensures that concurrent EF instances do not all call `tokenAuth` simultaneously — only one wins the lock, refreshes, and releases; others reuse the refreshed token.

**Responsibilities:**
- Read `payment_gateway_tokens WHERE gateway_slug='netcred' FOR UPDATE`.
- Check `expires_at - now() < 60 minutes`.
- If refresh needed: call `tokenAuth(username, password)` from Vault.
- Assert `user.sandbox === false` in production.
- Upsert `payment_gateway_tokens` with new token and `expires_at = now() + 24h`.
- COMMIT to release the lock.
- If no refresh needed: ROLLBACK (no write needed).
- On `tokenAuth` failure: emit CRITICAL Sentry; abort; do NOT increment attempt count.

**Implementation Details:**
```typescript
// supabase/functions/_shared/payment/netcred-auth.ts

export async function getNetCredToken(supabaseAdmin: SupabaseClient): Promise<string> {
  const { data: row, error } = await supabaseAdmin
    .from('payment_gateway_tokens')
    .select('token, expires_at')
    .eq('gateway_slug', 'netcred')
    .single();
    // Note: FOR UPDATE must be called via RPC due to supabase-js limitation

  // Delegate to a SECURITY DEFINER RPC for the actual FOR UPDATE + refresh logic
  const { data, error: rpcError } = await supabaseAdmin
    .rpc('acquire_or_refresh_netcred_token');

  if (rpcError) {
    Sentry.captureMessage('tokenAuth failure', { level: 'fatal', extra: { error: rpcError } });
    throw new ProviderAuthError('NETCRED_AUTH_FAILURE');
  }

  return data.token;
}
```
- The `FOR UPDATE` serialization MUST be implemented via a `SECURITY DEFINER` RPC (`acquire_or_refresh_netcred_token`) that calls `tokenAuth` via `pg_net` or returns the cached token.
- Alternatively: the EF opens a direct Postgres connection via `pg` client with explicit `BEGIN; SELECT FOR UPDATE; ... COMMIT;` to handle the lock correctly.
- Sandbox assertion: `if (user.sandbox === true) { Sentry.captureMessage('CRITICAL: sandbox token in production', { level: 'fatal' }); throw new Error('SANDBOX_CREDENTIALS_IN_PRODUCTION'); }`.
- Token stored encrypted: if stored as Vault reference, the RPC decrypts at read time.

**Deliverables:**
- `supabase/functions/_shared/payment/netcred-auth.ts`
- RPC `acquire_or_refresh_netcred_token` (migration `20260624000025_rpc_netcred_token.sql`).
- Unit test: concurrent token refresh — only one tokenAuth call issued.
- Unit test: sandbox assertion fires CRITICAL.

**Dependencies:**
- Tasks 3, 25.

**Runtime Guarantees:**
- Exactly-once `tokenAuth` call per refresh cycle under concurrency.
- Sandbox assertion NEVER allows real charges with sandbox credentials.

**Failure Handling:**
- `tokenAuth` failure: CRITICAL Sentry; ABORT charge; schedule stays FAILED (no count increment per Req 2 AC4).
- Lock wait timeout: EF should set a short `lock_timeout` (500ms) and handle gracefully.

**Observability:**
- `refreshed_at` column update on each refresh.
- CRITICAL Sentry on sandbox detection.

**Security Considerations:**
- Credentials read from Vault at runtime — never cached in EF memory between invocations.

**Requirements covered:** 2
**Acceptance Criteria covered:** 2A.1, 2A.2, 2A.3, 2A.4, 2A.5

---

### 27. [ ] Implement `NetCredAdapter.createCharge()` + `getTransaction()` + `referenceCode` Reconciliation

**Description:**
Implement the core charge execution methods of the `NetCredAdapter`. `createCharge()` translates `CreateChargeInput` to the NetCred `chargeCreate` GraphQL mutation. `getTransaction()` is used for timeout recovery and `referenceCode` conflict resolution. The adapter encapsulates ALL NetCred-specific field mappings — calling code is gateway-agnostic.

**Responsibilities:**
- Implement `chargeCreate` GraphQL mutation construction.
- Map `CreateChargeInput` → NetCred `chargeInput` (companyId, paymentProfileId, payoutRuleInput, orderInput, customerIpAddress).
- Implement `getTransaction(referenceCode)` via NetCred `transactions` query.
- Handle `referenceCode` conflict: detect specific error code, call `getTransaction`, reconcile.
- Implement error classification: terminal vs retryable.
- Return typed `CreateChargeResult` with `transactionState`.

**Implementation Details:**
```typescript
// supabase/functions/_shared/payment/netcred-adapter.ts

async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
  const token = await getNetCredToken(this.supabaseAdmin);
  const chargeInput = this.mapToNetCredCharge(input);

  const startTime = Date.now();
  try {
    const response = await this.graphqlClient.mutate({
      mutation: CHARGE_CREATE_MUTATION,
      variables: { input: chargeInput },
      headers: { Authorization: `Bearer ${token}` }
    });

    const latency = Date.now() - startTime;
    const txState = response.data?.chargeCreate?.transaction?.transactionState;

    if (txState === 'PAID') return { success: true, transactionState: 'PAID', ... };
    if (txState === 'IN_ANALYSIS') return { success: true, transactionState: 'IN_ANALYSIS', ... };
    if (txState === 'REJECTED') return { success: false, transactionState: 'REJECTED',
      error: { code: 'TERMINAL', message: ..., originalCode: 'REJECTED' } };

  } catch (err) {
    if (isReferenceCodeConflict(err)) {
      const existing = await this.getTransaction({ referenceCode: input.referenceCode });
      return this.reconcileFromExisting(existing);
    }
    if (isNetworkError(err) || is5xxError(err)) {
      return { success: false, error: { code: 'RETRYABLE', message: err.message } };
    }
    if (isTerminalError(err)) {
      return { success: false, error: { code: 'TERMINAL', message: err.message, originalCode: getErrorCode(err) } };
    }
    throw err; // unexpected — let caller handle
  }
}

async getTransaction(input: GetTransactionInput): Promise<GetTransactionResult | null> {
  // Returns null if no transaction found for referenceCode
}
```
- `mapToNetCredCharge`: `companyId = provider_accounts.netcred_company_id`, `paymentProfileId = payment_tokens.provider_payment_profile_id`, `orderInput.referenceCode = contracted_service_id`, `orderInput.sessionId = clearsale_session_id`.
- Terminal error codes: `REJECTED`, `CPF_INVALID`, `BILLING_ADDRESS_MISSING`, `CARD_NOT_FOUND`.
- Retryable: network timeout, HTTP 5xx, `INTERNAL_SERVER_ERROR`.

**Deliverables:**
- `supabase/functions/_shared/payment/netcred-adapter.ts`
- `CHARGE_CREATE_MUTATION` GraphQL document.
- Unit test: PAID response parsed correctly.
- Unit test: `referenceCode` conflict → `getTransaction` reconciliation.
- Unit test: network timeout → RETRYABLE error.
- Unit test: REJECTED → TERMINAL error.

**Dependencies:**
- Tasks 25, 26.

**Runtime Guarantees:**
- Terminal errors never trigger retry budget consumption in the cron.
- `getTransaction` returns null (not throws) for unknown referenceCode.

**Security Considerations:**
- NetCred API calls over HTTPS only.
- No card data logged from API responses.

**Requirements covered:** 1, 2, 10, 11, 23
**Acceptance Criteria covered:** 1A.1, 1A.2, 1A.5, 1A.6, 10A.8, 23A.3

---

### 28. [ ] Implement `NetCredAdapter.tokenizeCard()` + `refundTransaction()` + `getProviderCredentials()`

**Description:**
Implement the remaining `NetCredAdapter` methods: card tokenization (mapped to `paymentProfileCreate`), refund (mapped to `transactionRefund`), and provider credential lookup (mapped to `companies` query). `refundTransaction` MUST handle `ALREADY_REFUNDED` idempotently.

**Responsibilities:**
- `tokenizeCard()`: maps to `paymentProfileCreate`; `persist: false`; `billingAddressInput` always included.
- `refundTransaction()`: maps to `transactionRefund`; handles `ALREADY_REFUNDED` with `code: 'ALREADY_REFUNDED'`.
- `getProviderCredentials()`: maps to `companies(document: "...")` query; returns null if no record found.
- `AdapterRegistry.get(gateway_slug)` routing: returns correct adapter instance.

**Implementation Details:**
- `tokenizeCard` enforces `billingAddressInput` mandatory in production (throws `BILLING_ADDRESS_REQUIRED` if missing before gateway call).
- `paymentProfileCreate` with `customerInput.persist = false`.
- `refundTransaction` catches `ALREADY_REFUNDED` gateway error and returns `{ success: true, error: { code: 'ALREADY_REFUNDED' } }` — not a throw.
- `AdapterRegistry`: `const registry = new Map([['netcred', new NetCredAdapter(config)]])`; `get(slug)` throws if slug not registered.

**Deliverables:**
- Full `NetCredAdapter` implementation in `_shared/payment/netcred-adapter.ts`.
- `AdapterRegistry` in `_shared/payment/registry.ts`.
- Unit test: `ALREADY_REFUNDED` → idempotent success.
- Unit test: missing `billingAddressInput` → `BILLING_ADDRESS_REQUIRED` before gateway call.

**Dependencies:**
- Task 25, 26.

**Runtime Guarantees:**
- `ALREADY_REFUNDED` is not re-thrown; caller handles idempotently.
- `billingAddressInput` validation runs before any gateway call.

**Security Considerations:**
- `tokenizeCard` MUST NOT log raw card data from the input.

**Requirements covered:** 1, 6, 15
**Acceptance Criteria covered:** 1A.7, 6A.2, 15A.8

---

### 29. [ ] Implement Error Classification Module

**Description:**
Implement the centralized error classification module that categorizes gateway errors as `TERMINAL` or `RETRYABLE`. This module is used by the cron EF and manual charge EF to determine state transitions. Terminal errors MUST immediately transition to `FAILED_PERMANENT` regardless of remaining retry budget.

**Responsibilities:**
- Define `TERMINAL_ERROR_CODES` constant set.
- Implement `classifyChargeError(error: ChargeError): 'terminal' | 'retryable'`.
- Implement `isTerminalGatewayState(transactionState: string): boolean`.
- Export from `_shared/payment/error-classification.ts`.

**Implementation Details:**
```typescript
export const TERMINAL_ERROR_CODES = new Set([
  'REJECTED', 'CPF_INVALID', 'BILLING_ADDRESS_MISSING',
  'CARD_NOT_FOUND', 'REFERENCE_CODE_CONFLICT_UNRESOLVABLE'
]);

export const TERMINAL_STATES = new Set([
  'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'VOIDED', 'CANCELLED', 'EXPIRED'
]);

export function classifyChargeError(error: ChargeError): 'terminal' | 'retryable' {
  if (error.code === 'TERMINAL') return 'terminal';
  if (error.code === 'AUTH_FAILURE') return 'retryable'; // no count increment
  if (TERMINAL_ERROR_CODES.has(error.originalCode ?? '')) return 'terminal';
  return 'retryable';
}

export function isTerminalGatewayState(state: string): boolean {
  return TERMINAL_STATES.has(state);
}

export function isValidWebhookTransition(fromState: string, toState: string): boolean {
  // Prevents state machine regression from webhooks
  if (TERMINAL_STATES.has(fromState) && fromState !== toState) {
    if (toState === 'PAID' && fromState === 'IN_ANALYSIS') return true;
    return false;
  }
  return true;
}
```

**Deliverables:**
- `supabase/functions/_shared/payment/error-classification.ts`
- Unit tests: all terminal error codes classified correctly.
- Unit test: AUTH_FAILURE classified as retryable (no count increment).
- Unit test: webhook regression guard prevents PAID → IN_ANALYSIS.

**Dependencies:**
- Task 25.

**Runtime Guarantees:**
- Terminal errors never consume retry budget.
- State machine regression prevention in webhook handler.

**Requirements covered:** 11, 17
**Acceptance Criteria covered:** 11A.3, 17A.3

---

## Phase 6: Edge Functions — Client-Facing

---

### 30. [ ] Implement `calculate-installment-options` Edge Function + HMAC Signing

**Description:**
Implement the installment calculation Edge Function that computes 12 installment options using `platform_constants` and returns an HMAC-SHA256 signed payload. The signature prevents client-side tampering of computed amounts between the calculation and acceptance steps. The HMAC expires after 10 minutes.

**Responsibilities:**
- Accept `proposal_id`, `service_id`, `card_brand` as query params.
- Read all fee rates from `platform_constants` in a single SELECT.
- Apply brand/range resolution formula (same as `calculate_charge_amount()` RPC).
- Compute installment options 1–12 with banker's rounding.
- Read `INSTALLMENT_SIGNING_SECRET` from Vault.
- Compute `HMAC-SHA256(secret, JSON.stringify(payload))`.
- Return `{ installment_options, installment_selection_hmac, expires_at }`.
- Handle missing constants with safe defaults + WARN log.

**Implementation Details:**
```typescript
// supabase/functions/calculate-installment-options/index.ts

Deno.serve(async (req) => {
  const { proposal_id, service_id, card_brand } = parseQuery(req);
  const supabaseAdmin = createServiceRoleClient();

  const constants = await loadPlatformConstants(supabaseAdmin);
  const { data: proposal } = await supabaseAdmin.from('proposals').select('proposed_amount').eq('id', proposal_id).single();

  const base_amount = proposal.proposed_amount;
  const installment_options = computeInstallmentOptions(base_amount, card_brand, constants);

  const secret = await getVaultSecret(supabaseAdmin, 'INSTALLMENT_SIGNING_SECRET');
  const computed_at = new Date().toISOString();
  const expires_at = new Date(Date.now() + constants.installment_hmac_expires_minutes * 60000).toISOString();

  const payload = { proposal_id, service_id, base_amount, card_brand, installment_options, computed_at, expires_at };
  const hmac = await computeHMACSHA256(secret, JSON.stringify(payload));

  return Response.json({ installment_options, installment_selection_hmac: hmac, expires_at });
});
```
- Formula: `total_with_fees = ROUND((base_amount * (1 + rate/100)) + fixed_fee, 2)`; `installment_amount = ROUND(total_with_fees / n, 2)` using banker's rounding.
- HMAC uses `crypto.subtle.importKey` + `crypto.subtle.sign` for `HMAC-SHA256`.
- Missing constant: COALESCE to default; emit `logger.warn('platform_constant_missing', { key })`.

**Deliverables:**
- `supabase/functions/calculate-installment-options/index.ts`
- Unit test: fee formula for all brand/range combinations matches RPC output.
- Unit test: HMAC-SHA256 generation produces deterministic output.
- Unit test: missing constant triggers WARN and uses default.

**Dependencies:**
- Tasks 4, 25.

**Runtime Guarantees:**
- Formula identical to `calculate_charge_amount()` RPC.
- HMAC expires at `computed_at + 10min` — clock-independent expiry.

**Security Considerations:**
- `INSTALLMENT_SIGNING_SECRET` read from Vault — never hardcoded.
- HMAC computed server-side — client cannot forge amounts.

**Requirements covered:** 7, 25
**Acceptance Criteria covered:** 7A.1, 7A.2, 7A.3, 7A.4, 7A.6

---

### 31. [ ] Implement `tokenize-payment-card` Edge Function — PCI-Compliant Tokenization

**Description:**
Implement the card tokenization Edge Function. Raw card data (PAN, CVV) MUST be received by this function and IMMEDIATELY forwarded to NetCred's `paymentProfileCreate`. It MUST NOT be logged, cached, or stored in any Renovi infrastructure. The resulting `payment_tokens` record contains only gateway-issued references.

**Responsibilities:**
- Authenticate client JWT.
- Validate CPF format and check digits if provided.
- Resolve `netcred_company_id` from provider's `provider_accounts`.
- Call `NetCredAdapter.tokenizeCard()` with complete `billingAddressInput`.
- On `isActive = true`: INSERT `payment_tokens` record.
- On `isActive = false` or errors: return HTTP 422 with error messages.
- NEVER log PAN, CVV, or raw card fields.

**Implementation Details:**
```typescript
// supabase/functions/tokenize-payment-card/index.ts

Deno.serve(async (req) => {
  const { cardData, cpf, phone, billingAddress, providerServiceId } = await req.json();
  // cardData contains: cardNumber, cvv, expiryMonth, expiryYear, cardholderName
  // These MUST NOT be logged anywhere

  const user = await getAuthUser(req);
  const adapter = AdapterRegistry.get('netcred');

  // Resolve provider's netcred_company_id
  const providerAccount = await getProviderAccount(providerServiceId);

  const result = await adapter.tokenizeCard({
    cardData, // forwarded immediately to NetCred
    billingAddress, // mandatory per ClearSale requirement
    customerInput: { companyId: providerAccount.netcred_company_id, persist: false },
    cpf, phone
  });

  if (!result.isActive) {
    return Response.json({ errors: result.errors }, { status: 422 });
  }

  const { data: token } = await supabaseAdmin.from('payment_tokens').insert({
    client_id: user.id,
    provider_id: provider.id,
    provider_payment_profile_id: result.paymentProfileId,
    card_number_masked: result.cardNumberMasked,
    card_brand: result.cardBrand,
    provider_card_token: result.token,
    expiry_month: cardData.expiryMonth,
    expiry_year: cardData.expiryYear,
    cardholder_name: cardData.cardholderName,
    billing_address: billingAddress,
    state: 'ACTIVE'
  }).select('id, card_number_masked, card_brand').single();

  // INSERT payment_events: CardTokenized
  return Response.json({ payment_token_id: token.id, card_number_masked: token.card_number_masked, card_brand: token.card_brand });
});
```
- `billingAddressInput` is ALWAYS sent to NetCred — its absence causes `PaymentProfile requires BillingAddress` gateway error in production.
- `customerInput.persist = false` per design §4.2.3.
- No partial token record created on failure.

**Deliverables:**
- `supabase/functions/tokenize-payment-card/index.ts`
- PCI audit log: confirm no card data logged in EF.
- Unit test: `isActive = false` → HTTP 422, no token record.
- Unit test: missing `billingAddress` → HTTP 422 before gateway call.

**Dependencies:**
- Tasks 5, 25, 28.

**Runtime Guarantees:**
- No PAN/CVV at rest in any Renovi system.
- No partial token records on failure.

**Security Considerations:**
- Logging MUST explicitly exclude `cardData` fields.
- `BILLING_ADDRESS_REQUIRED` thrown before gateway call.

**Requirements covered:** 6, 24
**Acceptance Criteria covered:** 6A.1, 6A.2, 6A.3, 6A.4, 24A.1, 24A.2

---

### 32. [ ] Implement `accept-proposal` Edge Function — Full Orchestration

**Description:**
Implement the `accept-proposal` Edge Function — the primary client-facing orchestration endpoint. It validates the HMAC signature, pricing signature, token state, and provider credentialing before calling `accept_proposal_rpc()`. Client IP and `clearsale_session_id` are captured and forwarded to the RPC.

**Responsibilities:**
- Authenticate client JWT.
- Parse and validate `installment_selection_hmac` (timing-safe comparison, expiry check).
- Validate `pricing_signature` over `proposed_amount`, `tax_amount`, `final_amount`.
- Validate `payment_token_id` state = ACTIVE.
- Validate provider `onboarding_status = 'ACTIVE'`.
- Extract client IP from `X-Forwarded-For` or `CF-Connecting-IP`.
- Call `accept_proposal_rpc()` with all parameters.
- Handle idempotent retry (return existing IDs on conflict).
- Log WARN if `clearsale_session_id` is absent.

**Implementation Details:**
```typescript
// supabase/functions/accept-proposal/index.ts

Deno.serve(async (req) => {
  const body = await req.json();
  const { proposal_id, installment_number, installment_selection_hmac,
          payment_token_id, clearsale_session_id, scheduled_date } = body;

  const user = await getAuthUser(req);
  const clientIp = extractClientIp(req); // X-Forwarded-For or CF-Connecting-IP

  // HMAC validation
  const secret = await getVaultSecret('INSTALLMENT_SIGNING_SECRET');
  const hmacValid = await validateInstallmentHMAC(installment_selection_hmac, body, secret);
  if (!hmacValid.valid) {
    return errorResponse(400, hmacValid.expired ? 'INSTALLMENT_SIGNATURE_EXPIRED' : 'INVALID_INSTALLMENT_SIGNATURE');
  }

  // Token state validation
  const token = await getPaymentToken(payment_token_id, user.id);
  if (!token || token.state !== 'ACTIVE') {
    return errorResponse(422, 'PAYMENT_TOKEN_INACTIVE');
  }

  // Provider credentialing validation
  const provider = await getProviderAccount(body.provider_id);
  if (provider?.onboarding_status !== 'ACTIVE') {
    return errorResponse(409, 'PROVIDER_NOT_CREDENTIALED');
  }

  if (!clearsale_session_id) {
    logger.warn('missing_clearsale_session_id', { proposal_id });
  }

  const result = await supabaseAdmin.rpc('accept_proposal_rpc', {
    p_proposal_id: proposal_id,
    p_client_id: user.id,
    p_provider_id: body.provider_id,
    p_gateway_slug: 'netcred',
    p_payment_token_id: payment_token_id,
    p_installment_number: installment_number,
    p_base_amount: body.base_amount,
    p_service_scheduled_at: scheduled_date,
    p_clearsale_session_id: clearsale_session_id,
    p_client_ip_address: clientIp,
    p_actor_id: user.id
  });

  return Response.json({ contracted_service_id: result.contracted_service_id });
});
```
- HMAC validation uses `crypto.timingSafeEqual` (constant-time comparison).
- Expiry: `expires_at < new Date()` returns `INSTALLMENT_SIGNATURE_EXPIRED`.
- On `INSTALLMENT_SIGNATURE_EXPIRED`: client re-opens installment step with preserved card token.

**Deliverables:**
- `supabase/functions/accept-proposal/index.ts`
- Integration test: HMAC expired → HTTP 400 + `INSTALLMENT_SIGNATURE_EXPIRED`.
- Integration test: inactive provider → HTTP 409.
- Integration test: idempotent retry returns existing `contracted_service_id`.

**Dependencies:**
- Tasks 18, 30, 31, 25.

**Runtime Guarantees:**
- Timing-safe HMAC comparison prevents timing attacks.
- Atomic creation via `accept_proposal_rpc()`.
- Idempotent on duplicate submission.

**Security Considerations:**
- `crypto.timingSafeEqual` for HMAC comparison.
- Client IP extracted server-side — cannot be forged by request body.

**Requirements covered:** 7, 8, 9, 22, 27, 31
**Acceptance Criteria covered:** 7A.5, 8A.1, 8A.2, 8A.3, 8A.4, 8A.5, 8A.6, 8A.7, 27A.2, 31A.6, 31A.7

---

### 33. [ ] Implement `update-payment-method` Edge Function

**Description:**
Implement the `update-payment-method` Edge Function that allows a client to change their payment method for a service already in `PENDING_PAYMENT` state. If the card brand changes (e.g., Visa → Elo), a new HMAC-signed installment calculation MUST be obtained and validated. `base_amount` and `charge_scheduled_at` MUST NOT change.

**Responsibilities:**
- Authenticate client JWT; verify service ownership.
- SELECT `payment_schedules WHERE contracted_service_id = service_id AND state IN ('SCHEDULED','FAILED') FOR UPDATE`.
- Validate new token is `ACTIVE`.
- Detect card brand change.
- On brand change without valid HMAC: return `INSTALLMENT_HMAC_REQUIRED`.
- On brand change with valid HMAC: UPDATE `payment_token_id` and `final_amount`.
- On same brand: UPDATE `payment_token_id` only.
- INSERT `payment_audit_log`: `PAYMENT_METHOD_UPDATED`.
- Do NOT reset `upcoming_charge_notified_at`.

**Implementation Details:**
- `FOR UPDATE` on `payment_schedules` prevents race with concurrent cron charge.
- If schedule not in `SCHEDULED` or `FAILED`: return HTTP 409 `INVALID_SCHEDULE_STATE`.
- Brand change flow: frontend must re-call `calculate-installment-options` with new `card_brand`.
- Audit log metadata: `{ old_token_id, new_token_id, old_brand, new_brand }`.

**Deliverables:**
- `supabase/functions/update-payment-method/index.ts`
- Test: brand change without HMAC → HTTP 400 `INSTALLMENT_HMAC_REQUIRED`.
- Test: same brand → update succeeds without HMAC.

**Dependencies:**
- Tasks 8, 11, 30.

**Runtime Guarantees:**
- `FOR UPDATE` prevents concurrent charge during method update.
- `base_amount` and `charge_scheduled_at` immutable.

**Requirements covered:** 8
**Acceptance Criteria covered:** 8A.8

---

### 34. [ ] Implement `manual-charge-payment` Edge Function

**Description:**
Implement the `manual-charge-payment` Edge Function for client-initiated payment recovery. This EF executes an identical charge flow to the cron but with fresh ClearSale session data, `manual_attempt_count` tracking, and a T-12h gate. `automatic_attempt_count` MUST NOT be incremented on manual attempts.

**Responsibilities:**
- Authenticate client JWT; verify service ownership.
- Validate `state ∈ {FAILED, FAILED_PERMANENT}`.
- Validate T-12h gate: `service_scheduled_at - now() > 12 hours`.
- Acquire `FOR UPDATE` lease on `payment_schedules`.
- Update `state = 'PROCESSING'`, `locked_until = now() + 10min`, `manual_attempt_count++`, fresh `clearsale_session_id` and `client_ip_address`.
- Call `calculate_charge_amount()` RPC.
- Execute `adapter.createCharge()`.
- Commit PAID/FAILED/FAILED_PERMANENT state + audit + events.
- Enqueue notifications AFTER TX commit.
- Return HTTP 409 with `PAYMENT_ALREADY_IN_PROGRESS` on lock wait timeout.

**Implementation Details:**
- `FOR UPDATE SKIP LOCKED` (not blocking) — if locked, return 409 immediately.
- Fresh `clearsale_session_id` from request body (client generates new UUID on manual payment screen).
- `manual_attempt_count` increment (separate from `automatic_attempt_count`).
- On terminal error: `FAILED_PERMANENT` + offer new card option.
- On retryable error: `FAILED`; `automatic_attempt_count` unchanged (manual retries don't affect cron retry budget from client perspective; however cron FAILED path continues).
- T-12h server-side check: `service_scheduled_at - now() <= 12 hours` → HTTP 409 `SERVICE_AUTO_CANCELLED`.

**Deliverables:**
- `supabase/functions/manual-charge-payment/index.ts`
- Test: T-12h gate → HTTP 409 `SERVICE_AUTO_CANCELLED`.
- Test: concurrent cron lock → HTTP 409 `PAYMENT_ALREADY_IN_PROGRESS`.
- Test: fresh clearsale_session_id persisted before charge.

**Dependencies:**
- Tasks 17, 27, 29, 8, 11.

**Runtime Guarantees:**
- `FOR UPDATE` prevents concurrent cron/manual execution.
- `automatic_attempt_count` unaffected by manual attempts.
- Fresh ClearSale session on every manual retry.

**Security Considerations:**
- T-12h gate enforced server-side.
- Rate limiting via `platform_rate_limits`.

**Requirements covered:** 13, 31
**Acceptance Criteria covered:** 13A.1, 13A.2, 13A.3, 13A.4, 13A.5, 31A.8

---

### 35. [ ] Implement `process-refund` Edge Function — ToS §2.2 Penalty Computation

**Description:**
Implement the refund processing Edge Function. It computes the refund amount according to the ToS §2.2 cancellation policy, transitions the schedule to `REFUND_REQUESTED`, calls `transactionRefund` via the adapter, and records the refund submission in the audit log. The final `REFUNDED`/`PARTIALLY_REFUNDED` state transition is confirmed by the subsequent webhook.

**Responsibilities:**
- Authenticate client JWT; verify service ownership.
- SELECT `payment_schedules WHERE contracted_service_id = service_id AND state = 'PAID' FOR UPDATE`.
- Compute `refund_amount` using `computeRefundAmount()` function (ToS §2.2).
- BEGIN TX: `state = 'REFUND_REQUESTED'`; UPDATE `contracted_services.status = 'CANCELLED'`; INSERT audit `REFUND_SUBMITTED`.
- COMMIT TX.
- Call `adapter.refundTransaction()`.
- On success: return HTTP 200 with `refund_amount` and `expected_days: 30-60`.
- On `ALREADY_REFUNDED`: idempotent no-op; return HTTP 200.
- On other error: CRITICAL Sentry; INSERT audit `REFUND_FAILED`; return HTTP 500 + support link.

**Implementation Details:**
```typescript
function computeRefundAmount(chargeAmount: Decimal, baseAmount: Decimal,
  serviceScheduledAt: Date, initiator: 'client' | 'provider'): { refundAmount: Decimal, penaltyTier: string } {
  if (initiator === 'provider') {
    return { refundAmount: chargeAmount, penaltyTier: 'PROVIDER_FULL_REFUND' };
  }
  const hoursUntil = differenceInHours(serviceScheduledAt, new Date());
  if (hoursUntil > 48) return { refundAmount: baseAmount, penaltyTier: 'FULL_REFUND' };
  if (hoursUntil >= 12) return { refundAmount: baseAmount.mul('0.90'), penaltyTier: 'PENALTY_10' };
  return { refundAmount: baseAmount.mul('0.70'), penaltyTier: 'PENALTY_30' };
}
```
- `IN_ANALYSIS` state: block cancellation with HTTP 409 `PAYMENT_IN_ANALYSIS`.
- `COMPLETED` status: block with HTTP 409 `SERVICE_NOT_CANCELLABLE`.
- Pre-charge cancellation (`SCHEDULED`/`FAILED`/`FAILED_PERMANENT`): no gateway call; direct `CANCELLED` transition.
- Provider-initiated cancellation: `refund_amount = charge_amount` (full, including fees).

**Deliverables:**
- `supabase/functions/process-refund/index.ts`
- `computeRefundAmount()` utility function with full test coverage.
- Test: >48h → full refund.
- Test: 12–48h → 90% refund.
- Test: <12h → 70% refund.
- Test: provider-initiated → full charge_amount refund.
- Test: `IN_ANALYSIS` state → HTTP 409.

**Dependencies:**
- Tasks 8, 11, 28.

**Runtime Guarantees:**
- `REFUND_REQUESTED` state set BEFORE gateway call.
- Final state confirmed only via webhook.
- `ALREADY_REFUNDED` handled idempotently.

**Requirements covered:** 15
**Acceptance Criteria covered:** 15A.1, 15A.2, 15A.3, 15A.4, 15A.5, 15A.6, 15A.7, 15A.8, 15A.9, 15A.10

---

### 36. [ ] Implement `dispatch-kyc-email` Edge Function — KYC Submission + Email Dispatch

**Description:**
Implement the KYC submission and email dispatch Edge Function. It atomically persists the KYC submission, transitions the provider account to `DOCUMENTS_SUBMITTED`, and dispatches the formatted KYC email to `credenciamento@renovi.com.br` via Resend. Email failure MUST NOT revert the `DOCUMENTS_SUBMITTED` state — it MUST be queued for retry.

**Responsibilities:**
- Authenticate provider JWT.
- Validate all required KYC fields for entity type (CPF vs CNPJ).
- Validate CPF format + check digits.
- For CNPJ: validate CNPJ format + check digits.
- BEGIN TX: (1) INSERT `provider_kyc_submissions`; (2) UPDATE `provider_accounts SET onboarding_status = 'DOCUMENTS_SUBMITTED', onboarding_submitted_at = now()`; (3) INSERT `payment_audit_log` `KYC_SUBMITTED`; **(4) UPDATE `provider_profiles_private` SET `phone = p_phone`, `legal_representative_phone = p_legal_representative_phone` WHERE `provider_id = auth.uid()` — fulfils Req 3 AC4 point (5); this UPDATE MUST be in the same TX as the KYC submission.** COMMIT.
- Call Resend API to send email to `credenciamento@renovi.com.br` with all KYC fields and document attachment URLs.
- On email success: UPDATE `provider_accounts.email_dispatched_at = now()`.
- On email failure: enqueue retry job to `message_dispatcher_queue`; log WARN.

**Implementation Details:**
- Email failure does NOT rollback the TX — `DOCUMENTS_SUBMITTED` is preserved.
- Provider app shows "submitting..." until `email_dispatched_at` is non-NULL.
- Document attachment URLs point to Supabase Storage; included as hyperlinks in email body.
- Email format: structured HTML with all KYC fields, organized for credenciamento team review.

**Deliverables:**
- `supabase/functions/dispatch-kyc-email/index.ts`
- Test: TX committed before email call.
- Test: email failure → status preserved, retry job enqueued.
- Test: CPF invalid format → HTTP 422 before any DB call.

**Dependencies:**
- Tasks 7, 6, 11.

**Runtime Guarantees:**
- Atomic TX: KYC submission and status update always together.
- Email retry: independent of TX; no revert on email failure.

**Security Considerations:**
- Contains PII — LGPD compliance required.
- Resend API key from Vault.

**Requirements covered:** 3
**Acceptance Criteria covered:** 3A.1, 3A.2, 3A.3, 3A.4 (all 5 points including provider_profiles_private update), 3A.5

---

## Phase 7: Edge Functions — Cron Workers

---

### 37. [ ] Implement `schedule-netcred-charges` EF — SKIP LOCKED Queue Consumer

**Description:**
Implement the T-2 charge execution cron worker — the most critical Edge Function in the payment system. It implements the complete charge execution pipeline: queue dequeue with `FOR UPDATE SKIP LOCKED`, lease commit before gateway call, per-schedule error boundary, `getTransaction` timeout recovery check, final state commit, and notification enqueueing.

**Responsibilities:**
- Read all relevant `platform_constants` at invocation start.
- Execute eligibility query with all 8 filters (design §4.5.1).
- `FOR UPDATE SKIP LOCKED` on eligible records; commit lease BEFORE gateway call.
- For each acquired schedule (independent error boundary + Sentry span):
  - Call `calculate_charge_amount()` RPC.
  - Check for prior `PAID` transaction via `getTransaction(referenceCode)` if recovering from `FAILED`.
  - Assemble `chargeCreate` payload with `clearsale_session_id`, `client_ip_address`, `referenceCode`.
  - Execute `adapter.createCharge()`.
  - Commit result state in new TX.
  - Enqueue notifications after TX commit.
- Return summary of processed schedules.

**Implementation Details:**
```typescript
// schedule-netcred-charges/index.ts — core charge loop

for (const schedule of acquiredSchedules) {
  const span = Sentry.startSpan({ name: 'charge_execution', data: { schedule_id: schedule.id } });
  try {
    // Timeout recovery: check prior PAID state before issuing new charge
    if (schedule.automatic_attempt_count > 1) {
      const existing = await adapter.getTransaction({ referenceCode: schedule.contracted_service_id });
      if (existing?.transactionState === 'PAID') {
        await commitPaidTransition(schedule, existing);
        continue;
      }
    }

    const chargeAmount = await supabaseAdmin.rpc('calculate_charge_amount', {
      p_token_id: schedule.payment_token_id,
      p_base_amount: schedule.base_amount,
      p_installment_n: schedule.installment_number
    });

    if (!schedule.clearsale_session_id) {
      logger.warn('missing_clearsale_session_id', { schedule_id: schedule.id });
    }

    const result = await adapter.createCharge({
      referenceCode: schedule.contracted_service_id,
      amount: chargeAmount,
      paymentMethod: { type: 'CREDIT_CARD', installmentNumber: schedule.installment_number, paymentProfileId: token.provider_payment_profile_id },
      payoutRule: buildPayoutRule(providerAccount),
      sessionId: schedule.clearsale_session_id ?? undefined,
      customerIpAddress: schedule.client_ip_address ?? undefined
    });

    await commitChargeResult(schedule, result, chargeAmount);
    await enqueueNotifications(schedule, result);
  } catch (err) {
    Sentry.captureException(err, { extra: { schedule_id: schedule.id } });
    await commitFailedState(schedule, err);
  } finally {
    span.finish();
  }
}
```

**`enqueueNotifications` MUST handle all outcome branches explicitly per Req 12:**

```typescript
async function enqueueNotifications(schedule: PaymentSchedule, result: ChargeResult) {
  switch (result.outcome) {
    case 'PAID':
      // Req 12 AC1: Push + Email to client (bypass priority)
      // Content: service name, scheduled date, charged amount, installment summary
      await dispatcher.enqueue({ type: 'PUSH', userId: schedule.client_id, bypassPriority: true,
        payload: { template: 'payment_success', serviceId: schedule.contracted_service_id,
                   chargedAmount: result.paidAmount, installmentNumber: schedule.installment_number } });
      await dispatcher.enqueue({ type: 'EMAIL', userId: schedule.client_id, bypassPriority: true,
        payload: { template: 'payment_success_email', serviceId: schedule.contracted_service_id } });
      break;

    case 'FAILED':
      // Req 12 AC2: Push + Email to client (bypass); content MUST include remaining retry count
      await dispatcher.enqueue({ type: 'PUSH', userId: schedule.client_id, bypassPriority: true,
        payload: { template: 'payment_failed_retryable', serviceId: schedule.contracted_service_id,
                   remainingRetries: schedule.max_attempts - schedule.automatic_attempt_count,
                   deepLink: `renovi://services/${schedule.contracted_service_id}` } });
      await dispatcher.enqueue({ type: 'EMAIL', userId: schedule.client_id, bypassPriority: true,
        payload: { template: 'payment_failed_retryable_email', serviceId: schedule.contracted_service_id } });
      // Req 12 AC5: first failure only → Push to provider (non-financial content only)
      if (schedule.automatic_attempt_count === 1) {
        await dispatcher.enqueue({ type: 'PUSH', userId: schedule.provider_id, bypassPriority: false,
          payload: { template: 'provider_client_payment_pending',  // no amounts; non-financial
                     serviceId: schedule.contracted_service_id } });
      }
      break;

    case 'FAILED_PERMANENT':
      // Req 12 AC3: handled by auto-cancel EF (Task 39) after FAILED_PERMANENT → auto-cancel path
      // The cron itself also enqueues when committing FAILED_PERMANENT:
      await dispatcher.enqueue({ type: 'PUSH', userId: schedule.client_id, bypassPriority: true,
        payload: { template: 'payment_failed_permanent', serviceId: schedule.contracted_service_id,
                   deepLink: `renovi://services/${schedule.contracted_service_id}` } });
      await dispatcher.enqueue({ type: 'EMAIL', userId: schedule.client_id, bypassPriority: true,
        payload: { template: 'payment_failed_permanent_email', serviceId: schedule.contracted_service_id } });
      await dispatcher.enqueue({ type: 'PUSH', userId: schedule.provider_id, bypassPriority: true,
        payload: { template: 'provider_client_payment_failed_permanent',
                   serviceId: schedule.contracted_service_id } });
      break;

    case 'IN_ANALYSIS':
      // Req 12 AC4: Push to client ONLY — informing payment is under antifraude review
      // MUST NOT trigger auto-cancellation timing (exempted in auto_cancel WHERE clause)
      await dispatcher.enqueue({ type: 'PUSH', userId: schedule.client_id, bypassPriority: false,
        payload: { template: 'payment_in_analysis', serviceId: schedule.contracted_service_id } });
      // NO notification to provider for IN_ANALYSIS
      break;
  }
}
```
- Terminal error on first attempt: `automatic_attempt_count` decremented (the PROCESSING increment is undone — terminal errors MUST NOT consume retry budget per design §4.5.2).
- Per-schedule Sentry span includes: `gateway_latency_ms`, `transaction_state`, `charge_amount`, `attempt_number`.
- Batch size: 10 schedules per invocation (from `platform_constants` `charge_batch_size` or hardcoded 10).

**Deliverables:**
- `supabase/functions/schedule-netcred-charges/index.ts`
- Integration test: PAID transition commits correctly.
- Integration test: terminal error → `FAILED_PERMANENT`; attempt count not incremented.
- Integration test: retryable error → `FAILED` with `next_retry_at` set.
- Integration test: `getTransaction` reconciliation on retry.
- Concurrency test: two concurrent invocations do not double-charge same schedule.

**Dependencies:**
- Tasks 17, 24, 27, 28, 29, 8, 11, 12.

**Runtime Guarantees:**
- Lease committed before gateway call — crash safety.
- `FOR UPDATE SKIP LOCKED` — exactly-once processing per cron invocation.
- Per-schedule error isolation — one failure does not abort batch.
- Terminal errors do not consume retry budget.

**Failure Handling:**
- EF crash during gateway call: janitor recovers lease after TTL.
- `referenceCode` conflict: `getTransaction` reconciliation.
- `tokenAuth` failure: CRITICAL Sentry; schedule stays FAILED (no count increment).

**Observability:**
- Sentry span per schedule with gateway latency.
- Structured log: `charge_attempt_started`, `charge_attempt_completed`, `charge_attempt_failed`.
- `CRITICAL` alert on auth failure.

**Requirements covered:** 10, 11, 12, 23, 30, 31
**Acceptance Criteria covered:** 10A.1–10A.9, 11A.1–11A.7, 12A.1, 12A.2, 12A.4, 12A.5, 23A.1–23A.5, 31A.9

---

### 38. [ ] Implement `detect-netcred-onboarding` EF — Batch GraphQL Aliases

**Description:**
Implement the daily onboarding detection cron. It queries NetCred's `companies` GraphQL API using up to 50 aliased queries per HTTP request (batch pattern), detects providers with `companyState = ACTIVE` and `bankAccounts` populated, and atomically activates them. MUST NOT issue one HTTP request per provider.

**Responsibilities:**
- Query `provider_accounts WHERE state IN ('DOCUMENTS_SUBMITTED', 'UNDER_NETCRED_REVIEW') LIMIT 50`.
- Build single GraphQL request with up to 50 aliased `companies(document: "...")` queries.
- Process each alias result per design §4.1.2.
- Atomic activation TX: UPDATE `provider_accounts`, INSERT `payment_audit_log` (`PROVIDER_ACTIVATED`), INSERT `payment_events` (`ProviderCredentialed`).
- Update `UNDER_NETCRED_REVIEW` for non-empty, non-ACTIVE responses.
- Emit WARNING Sentry for multiple edges.
- Emit WARNING for ACTIVE state without bank accounts.
- Process batches of 50 with 2-second inter-batch delay.

**Implementation Details:**
- Batch alias key: `provider_${document.replace(/\D/g, '')}`.
- Response matching: compare `node.document` to local `provider_accounts.document`.
- WARNING for multiple edges: `edges.length > 1`.
- Activation invariant: `netcred_company_id` AND `netcred_bank_account_id` BOTH populated before `ACTIVE`.

**Deliverables:**
- `supabase/functions/detect-netcred-onboarding/index.ts`
- Test: batch of 50 issues single HTTP request.
- Test: multiple edges → WARNING Sentry, no activation.
- Test: ACTIVE + bankAccounts → atomic activation.
- Test: ACTIVE + no bankAccounts → `UNDER_NETCRED_REVIEW`.

**Dependencies:**
- Tasks 6, 28, 11, 12.

**Runtime Guarantees:**
- Exactly one HTTP request per batch of 50.
- Atomic activation: all 3 DB writes in single TX.

**Requirements covered:** 4, 29
**Acceptance Criteria covered:** 4A.1–4A.7

---

### 39. [ ] Implement `auto-cancel-unpaid-services` EF — T-12h Wrapper

**Description:**
Implement the auto-cancellation cron Edge Function that invokes `auto_cancel_services_rpc()` and enqueues the resulting notifications. The RPC handles the DB logic; this EF handles notification dispatch after the TX commits.

**Responsibilities:**
- Invoke `auto_cancel_services_rpc()` via RPC.
- Collect cancelled service IDs.
- Enqueue Push + Email notifications to clients (bypass priority).
- Enqueue Push notifications to providers.
- Emit Sentry WARNING for each auto-cancelled service.

**Implementation Details:**
- Call `supabaseAdmin.rpc('auto_cancel_services_rpc')` — returns cancelled service IDs.
- For each cancelled service: enqueue dispatcher jobs with `bypass_priority: true`.
- Sentry WARNING: `{ service_id, schedule_id, last_failure_reason, cancellation_reason }`.

**Deliverables:**
- `supabase/functions/auto-cancel-unpaid-services/index.ts`
- Test: cancelled services trigger notifications.
- Test: `IN_ANALYSIS` records not cancelled.

**Dependencies:**
- Task 20, 8.

**Runtime Guarantees:**
- Notifications enqueued AFTER RPC TX commit.
- `IN_ANALYSIS` exemption enforced in RPC.

**Requirements covered:** 14, 12, 21
**Acceptance Criteria covered:** 14A.1–14A.7, 12A.3, 12A.6 (manual charge success path in sibling EF — see Task 45), 21A.7 (Sentry WARNING per auto-cancelled service with service_id, schedule_id, last_failure_reason)

---

### 40. [ ] Implement `notify-upcoming-charges` EF — Pre-Charge Notification

**Description:**
Implement the 24h pre-charge notification cron. It selects `SCHEDULED` records within 24 hours of `charge_scheduled_at` with `upcoming_charge_notified_at IS NULL`, enqueues Push + Email notifications, and atomically marks them as notified.

**Responsibilities:**
- Execute eligibility query from design §4.10.
- Enqueue Push + Email to client: service summary, `charge_scheduled_at`, fee-inclusive amount, links to update payment method or cancel.
- Atomically UPDATE `upcoming_charge_notified_at = now()` WHERE `upcoming_charge_notified_at IS NULL` (race guard).
- Exclude emergency-scheduled services (charge_scheduled_at ≈ now()).
- Do NOT notify providers.

**Implementation Details:**
- Race guard: `UPDATE ... WHERE id = :schedule_id AND upcoming_charge_notified_at IS NULL` prevents duplicate notifications on concurrent invocations.
- Emergency scheduling detection: `charge_scheduled_at < now() + interval '1 hour'` → skip (charge has likely already happened or is imminent).

**Deliverables:**
- `supabase/functions/notify-upcoming-charges/index.ts`
- Test: duplicate invocation → second notification suppressed by `upcoming_charge_notified_at` guard.
- Test: emergency scheduled → not notified.

**Dependencies:**
- Tasks 8, 11.

**Runtime Guarantees:**
- At-most-once notification per schedule via `upcoming_charge_notified_at` guard.
- Notification sent to client only; provider not included.

**Requirements covered:** 33
**Acceptance Criteria covered:** 33A.1–33A.6

---

### 41. [ ] Implement `reconcile-netcred-payments` EF — Stale State Polling

**Description:**
Implement the 30-minute reconciliation polling cron. It detects payment schedules in intermediate states (`IN_ANALYSIS`, `PROCESSING`, `REFUND_REQUESTED`) older than 30 minutes and reconciles them with the gateway via `getTransaction(referenceCode)`. This is the fallback for missed webhooks.

**Responsibilities:**
- Select stale records: `state IN ('IN_ANALYSIS','PROCESSING','REFUND_REQUESTED') AND updated_at < now() - 30min`.
- For each: call `adapter.getTransaction({ referenceCode: contracted_service_id })`.
- Apply state transitions per gateway response (same as webhook path).
- On null: increment `reconciliation_failure_count`; emit WARN if count > 3.
- On network error: increment count; emit WARN Sentry.

**Implementation Details:**
- `PAID` response: apply full PAID transition identical to TRANSACTION_CAPTURE webhook handler.
- `REJECTED` response: apply `FAILED_PERMANENT` transition.
- `REFUNDED`/`PARTIALLY_REFUNDED`: apply corresponding terminal transition.
- `null` response: no state change; increment `reconciliation_failure_count`.

**Deliverables:**
- `supabase/functions/reconcile-netcred-payments/index.ts`
- Test: `IN_ANALYSIS` → PAID via reconciliation.
- Test: network error → count incremented, WARN emitted.

**Dependencies:**
- Tasks 27, 8, 11.

**Runtime Guarantees:**
- Idempotent: applying same transition multiple times is safe (state machine regression guard).
- `reconciliation_failure_count` tracks unresolvable states.

**Requirements covered:** 20
**Acceptance Criteria covered:** 20A.1–20A.4

---

### 42. [ ] Implement `auto-complete-executed-services` EF — 24h Auto-Completion

**Description:**
Implement the daily auto-completion cron that promotes `EXECUTED` services to `COMPLETED` when 24 hours have elapsed since `executed_at` and the client has not confirmed. This prevents operational deadlock from client inaction.

**Responsibilities:**
- Select `contracted_services WHERE status='EXECUTED' AND executed_at + interval '24 hours' <= now()`.
- Atomically: UPDATE `status='COMPLETED'`, `completed_at=now()`, `completed_by='system'`; INSERT `payment_audit_log` `SERVICE_AUTO_COMPLETED`; INSERT `payment_events` `ServiceCompleted`.
- Enqueue Push to client: service auto-confirmed.
- `is_disputed = true` MUST NOT block completion.

**Implementation Details:**
- Chargeback (`is_disputed = true`) is irrelevant to completion — service completion and dispute resolution are independent flows (Req 32 AC4).
- `completed_by = 'system'` distinguishes auto-completion from client confirmation.

**Deliverables:**
- `supabase/functions/auto-complete-executed-services/index.ts`
- Test: disputed service still auto-completes.
- Test: < 24h elapsed → not auto-completed.

**Dependencies:**
- Tasks 11, 12.

**Runtime Guarantees:**
- Atomic TX: status + audit + event.
- Dispute status does not block completion.

**Requirements covered:** 32
**Acceptance Criteria covered:** 32A.3, 32A.4

---

### 43. [ ] Implement `recover-payment-leases` EF — Janitor Orchestration

**Description:**
Implement the janitor Edge Function that invokes `recover_orphaned_payment_schedules()` RPC and reports recovery metrics. This EF is optional since the RPC can be called directly by pg_cron, but the EF wrapper provides Sentry observability and structured logging.

**Responsibilities:**
- Invoke `recover_orphaned_payment_schedules()` RPC.
- Log recovery statistics: `recovered_to_scheduled`, `recovered_to_failed`.
- Emit Sentry INFO breadcrumb per recovered record.
- Return HTTP 200 with recovery summary.

**Deliverables:**
- `supabase/functions/recover-payment-leases/index.ts`
- Test: orphaned records recovered correctly.

**Dependencies:**
- Task 19.

**Runtime Guarantees:**
- RPC handles concurrency via `FOR UPDATE SKIP LOCKED`.

**Requirements covered:** 23
**Acceptance Criteria covered:** 23A.2

---

## Phase 8: Webhook Processing

---

### 44. [ ] Implement `netcred-webhook` EF — Raw Persistence + HMAC Validation + Dispatcher

**Description:**
Implement the NetCred webhook ingestion Edge Function. This is the first line of defense for inbound payment events. The raw payload MUST be persisted BEFORE any validation or processing — this ensures no event is ever lost, even if subsequent processing fails. HMAC validation uses `crypto.timingSafeEqual` to prevent timing attacks.

**Responsibilities:**
- Capture raw body via `req.text()` before ANY parsing (preserves HMAC integrity).
- INSERT `payment_webhook_events` with `state = 'RECEIVED'` (persist first, validate second).
- Read `NETCRED_WEBHOOK_SECRET` from Vault.
- Compute `HMAC-SHA256(secret, rawBody)`.
- Compare with `X-NETCRED-Signature` using `crypto.timingSafeEqual`.
- On mismatch: UPDATE `state = 'FAILED'`, `failure_reason = 'INVALID_SIGNATURE'`; emit WARN Sentry; return HTTP 401.
- On match: UPDATE `state = 'VALIDATING'`; dispatch to per-event handler.
- Handle `WEBHOOK_PING`: no-op, HTTP 200.
- Handle unknown events: WARN log, HTTP 200.
- Dedup: `ON CONFLICT (gateway_slug, event_type, provider_event_id) DO NOTHING` then set `is_duplicate = true`.

**Implementation Details:**
```typescript
// netcred-webhook/index.ts

Deno.serve(async (req) => {
  const rawBody = await req.text(); // BEFORE any parsing
  const headers = Object.fromEntries(req.headers.entries());
  const eventType = req.headers.get('X-NETCRED-Event') ?? 'UNKNOWN';
  const signature = req.headers.get('X-NETCRED-Signature') ?? '';

  // Persist raw event immediately (before validation)
  const { data: event, error: insertError } = await supabaseAdmin
    .from('payment_webhook_events')
    .insert({
      gateway_slug: 'netcred',
      event_type: eventType,
      provider_event_id: extractEventId(rawBody),
      raw_payload: JSON.parse(rawBody),
      raw_headers: headers,
      state: 'RECEIVED'
    })
    .select('id')
    .single();

  if (insertError?.code === '23505') { // unique_violation = duplicate
    await markDuplicate(existingEventId);
    return new Response('OK', { status: 200 });
  }

  // HMAC validation
  const secret = await getVaultSecret('NETCRED_WEBHOOK_SECRET');
  const computed = await hmacSHA256(secret, rawBody);
  if (!timingSafeEqual(computed, hexToBytes(signature))) {
    await markFailed(event.id, 'INVALID_SIGNATURE');
    Sentry.captureMessage('webhook_signature_invalid', { level: 'warning', extra: { eventType } });
    return new Response('Unauthorized', { status: 401 });
  }

  await markValidating(event.id);

  // Dispatch to handler
  const handler = getWebhookHandler(eventType);
  if (!handler) {
    logger.warn('webhook_unknown_event_type', { event_type: eventType });
    await markProcessed(event.id);
    return new Response('OK', { status: 200 });
  }

  try {
    await handler(JSON.parse(rawBody), event.id);
    await markProcessed(event.id);
  } catch (err) {
    await markFailed(event.id, err.message);
    // Retry via process-webhook-retry cron
  }

  return new Response('OK', { status: 200 });
});
```
- Rate limiting: `checkIPRateLimit(clientIp)` via `platform_rate_limits` table.
- Heavy processing events: enqueue to `payment_webhook_processing_queue` and return HTTP 200 immediately.

**Deliverables:**
- `supabase/functions/netcred-webhook/index.ts`
- Test: raw body captured before JSON.parse; HMAC computed on raw body.
- Test: invalid signature → HTTP 401; event marked FAILED.
- Test: duplicate event → is_duplicate = true; HTTP 200; no reprocessing.
- Test: `WEBHOOK_PING` → HTTP 200; no-op.
- Test: unknown event type → WARN log; HTTP 200.

**Dependencies:**
- Tasks 10, 29, 13.

**Runtime Guarantees:**
- Raw payload persisted before validation — never lost.
- HMAC timing-safe comparison prevents side-channel attacks.
- At-most-once processing via UNIQUE dedup constraint.

**Failure Handling:**
- Processing exception: event marked FAILED; retry via cron.
- DB insert failure (non-dedup): CRITICAL Sentry; return HTTP 500 (gateway will retry).

**Observability:**
- `state` column tracks processing progress.
- WARN Sentry on signature failure.
- `processed_at - created_at` = end-to-end processing latency.

**Security Considerations:**
- `crypto.timingSafeEqual` mandatory for HMAC comparison.
- IP rate limiting via `platform_rate_limits`.
- Webhook secret from Vault only.

**Performance Considerations:**
- Immediate HTTP 200 for heavy events; async processing.
- Single-row dedup insert is O(1) with UNIQUE index.

**Requirements covered:** 16, 17, 24
**Acceptance Criteria covered:** 16A.1, 16A.2, 16A.3, 16A.4, 16A.5, 17A.1, 17A.2, 24A.4

---

### 45. [ ] Implement `TRANSACTION_CAPTURE` Webhook Handler — PAID Transition

**Description:**
Implement the `TRANSACTION_CAPTURE` webhook event handler. This is the primary mechanism for confirming `IN_ANALYSIS` → `PAID` transitions when antifraude approves a charge. The handler MUST apply the same PAID transition atomically (schedule + contracted_services + audit + events), just as the cron does on direct PAID response.

**Responsibilities:**
- Resolve `payment_schedules` via `referenceCode` (= `contracted_service_id`).
- Validate transition: current state must allow → PAID (regression guard).
- BEGIN TX: UPDATE `payment_schedules.state = 'PAID'`; UPDATE `contracted_services.status = 'CONFIRMED'`; INSERT `payment_audit_log` `CHARGE_PAID`; INSERT `payment_events` `ChargeSucceeded`.
- COMMIT TX.
- Enqueue success notifications to client (Push + Email) and provider (Push) AFTER TX.

**Implementation Details:**
- `isValidWebhookTransition(current_state, 'PAID')` check using error classification module.
- For already-PAID schedule: update only `webhook_confirmed_at` field (safe monotonic update); mark event PROCESSED (not DUPLICATE).
- `referenceCode` lookup: `payment_schedules WHERE contracted_service_id = payload.referenceCode`.

**Deliverables:**
- `supabase/functions/netcred-webhook/handlers/transaction-capture.ts`
- Test: `IN_ANALYSIS` → PAID via webhook.
- Test: already-PAID → only `webhook_confirmed_at` updated; no state change.
- Test: PAID → CONFIRMED on `contracted_services`.

**Dependencies:**
- Tasks 8, 11, 12, 29.

**Runtime Guarantees:**
- Atomic TX: schedule + service + audit.
- Notifications after TX commit.
- Regression guard prevents PAID → IN_ANALYSIS.

**Requirements covered:** 17, 18
**Acceptance Criteria covered:** 17A.3, 17A.4, 18A.1

---

### 46. [ ] Implement `TRANSACTION_UPDATE` Universal Fallback Handler

**Description:**
Implement the `TRANSACTION_UPDATE` webhook handler that acts as a universal state machine reconciliation event. It maps NetCred `transactionState` values to internal state transitions and applies the appropriate handler logic.

**Responsibilities:**
- Extract `transactionState` from webhook payload.
- Map to internal state: `PAID` → invoke TRANSACTION_CAPTURE logic; `REJECTED` → invoke FAILED_PERMANENT logic; `REFUNDED` → invoke TRANSACTION_REFUND logic; `VOIDED` → invoke CHARGE_VOID logic.
- Apply full corresponding state machine transition.
- Regression guard on all transitions.

**Deliverables:**
- `supabase/functions/netcred-webhook/handlers/transaction-update.ts`
- Test: `TRANSACTION_UPDATE` with `PAID` payload applies full PAID transition.
- Test: `TRANSACTION_UPDATE` with `REJECTED` applies FAILED_PERMANENT.

**Dependencies:**
- Tasks 45, 29.

**Runtime Guarantees:**
- Identical logic to direct event handlers — no duplicate code.
- Regression guard prevents all invalid state regressions.

**Requirements covered:** 18
**Acceptance Criteria covered:** 18A.2

---

### 47. [ ] Implement `TRANSACTION_REFUND` + `CHARGE_VOID` + `TRANSACTION_DISPUTE` Handlers

**Description:**
Implement the remaining critical webhook event handlers: refund confirmation, void, and dispute (chargeback).

**Responsibilities (TRANSACTION_REFUND):**
- Validate `state = 'REFUND_REQUESTED'`.
- Determine `REFUNDED` vs `PARTIALLY_REFUNDED` based on refunded amount.
- Atomically: UPDATE `payment_schedules.state`, `refunded_amount`, `refunded_at`; INSERT audit `REFUND_CONFIRMED`; INSERT event `RefundConfirmed`.
- Enqueue client notification: "Refund confirmed; expect 30–60 days on statement".

**Responsibilities (CHARGE_VOID / TRANSACTION_VOID):**
- UPDATE `state = 'VOIDED'`, `voided_at = now()`.
- INSERT audit.

**Responsibilities (TRANSACTION_DISPUTE):**
- SET `payment_schedules.is_disputed = true` (NO state change).
- Emit CRITICAL Sentry with `contracted_service_id` and `provider_transaction_id`.
- Do NOT auto-cancel or change `contracted_services.status`.
- Notify ops team via Sentry alert.

**Deliverables:**
- `supabase/functions/netcred-webhook/handlers/transaction-refund.ts`
- `supabase/functions/netcred-webhook/handlers/charge-void.ts`
- `supabase/functions/netcred-webhook/handlers/transaction-dispute.ts`
- Test: partial refund → `PARTIALLY_REFUNDED` with correct `refunded_amount`.
- Test: dispute → `is_disputed = true`; state unchanged; CRITICAL Sentry.

**Dependencies:**
- Tasks 8, 11.

**Runtime Guarantees:**
- Refund state transitions confirmed via webhook only.
- Dispute does NOT block service completion.

**Requirements covered:** 15, 18
**Acceptance Criteria covered:** 15A.9, 18A.3, 18A.4, 18A.5

---

### 48. [ ] Implement `PAYMENT_PROFILE_*` Webhook Handlers (TOKENIZE, DELETE, EXPIRING, UPDATE)

**Description:**
Implement the payment profile webhook handlers that manage `payment_tokens` state based on NetCred events.

**Responsibilities (PAYMENT_PROFILE_DELETE):**
- Set `payment_tokens.state = 'REVOKED'`.
- Find linked `SCHEDULED`/`FAILED` payment schedules.
- Set `payment_schedules.needs_payment_method_update = true`.
- Enqueue notification to client to update payment method.

**Responsibilities (PAYMENT_PROFILE_TOKENIZE):**
- If `isActive = false`: set `payment_tokens.state = 'TOKENIZATION_FAILED'`.
- If linked to `SCHEDULED` schedule: notify client.

**Responsibilities (PAYMENT_PROFILE_EXPIRING):**
- Find affected `payment_tokens` by `provider_payment_profile_id`.
- Find linked `SCHEDULED` payment schedules.
- Enqueue update-card notifications for each.

**Responsibilities (PAYMENT_PROFILE_UPDATE):**
- Sync token metadata (brand, expiry) from webhook payload.

**Deliverables:**
- `supabase/functions/netcred-webhook/handlers/payment-profile-*.ts`
- Test: PROFILE_DELETE → token REVOKED + schedule flagged.
- Test: PROFILE_EXPIRING → notifications sent to affected clients.

**Dependencies:**
- Tasks 5, 8.

**Runtime Guarantees:**
- Token state and schedule flags updated atomically.
- Notification enqueueing decoupled from state update.

**Requirements covered:** 6, 17
**Acceptance Criteria covered:** 6A.6, 6A.7, 17A.5

---

### 49. [ ] Implement `process-webhook-retry` EF — Exponential Backoff + Dead-Letter Promotion

**Description:**
Implement the webhook retry cron worker. It picks up `FAILED` webhook events, re-processes them with exponential backoff, and promotes events to `DEAD_LETTER` after 3 failures. Dead-letter events trigger CRITICAL Sentry alerts.

**Responsibilities:**
- Select `payment_webhook_events WHERE state='FAILED' AND next_retry_at <= now()`.
- Use `FOR UPDATE SKIP LOCKED` on retry queue.
- Re-invoke the original event handler (replay processing).
- On success: `state = 'PROCESSED'`, `processed_at = now()`.
- On failure: `retry_count++`; compute `next_retry_at = base * 2^(retry_count - 1) minutes`.
- After 3 failures: `state = 'DEAD_LETTER'`; emit CRITICAL Sentry.
- Dedup safety: idempotency constraints prevent duplicate state transitions.

**Implementation Details:**
```typescript
// Exponential backoff: 5min, 10min, 20min
function computeNextRetryAt(retryCount: number, baseMinutes: number): Date {
  const delayMs = baseMinutes * Math.pow(2, retryCount - 1) * 60000;
  return new Date(Date.now() + delayMs);
}
```
- `base_interval_minutes` from `platform_constants.webhook_base_retry_interval_minutes` (default: 5).
- Dead-letter CRITICAL Sentry: `{ event_type, provider_event_id, schedule_id (if resolvable), failure_reason }`.

**Deliverables:**
- `supabase/functions/process-webhook-retry/index.ts`
- Test: 3 consecutive failures → `DEAD_LETTER` + CRITICAL Sentry.
- Test: retry success → `PROCESSED`.
- Test: exponential backoff timing correct.

**Dependencies:**
- Tasks 10, 44, 45, 46, 47, 48.

**Runtime Guarantees:**
- Idempotency via UNIQUE constraint prevents double-processing on retry.
- Dead-letter after exactly 3 failures.

**Failure Handling:**
- Dead-letter manual reset: operator sets `state='RECEIVED'`, `retry_count=0`.

**Observability:**
- CRITICAL Sentry on dead-letter.
- `retry_count` metric for retry exhaustion rate.

**Security Considerations:**
- Replayed events re-validated for idempotency.

**Requirements covered:** 19
**Acceptance Criteria covered:** 19A.1, 19A.2, 19A.3, 19A.4

---

## Phase 9: Frontend — Checkout Stepper

---

### 50. [ ] Implement Checkout Stepper Profile Completeness RPC + Step Resolution

**Description:**
Implement the client-side checkout stepper step resolution logic. On stepper initialization, the frontend calls an RPC that returns which steps are required based on profile completeness. Steps are conditional and rendered in order: CPF (if missing) → Phone (if missing) → Card/Saved Card → Installments → Confirmation.

**Responsibilities:**
- Implement `get_checkout_step_requirements()` RPC that returns: `needs_cpf`, `needs_phone`, `needs_card`.
- Implement stepper state machine in `useCheckoutStepper` hook.
- Render only required steps based on RPC response.
- Preserve all stepper state across step navigation (no data loss on back/forward).

**Implementation Details:**
```sql
-- RPC: get_checkout_step_requirements
SELECT
  (SELECT cpf IS NULL FROM client_profiles_private WHERE user_id = auth.uid()) AS needs_cpf,
  (SELECT phone IS NULL FROM profiles WHERE id = auth.uid()) AS needs_phone,
  (NOT EXISTS (SELECT 1 FROM payment_tokens WHERE client_id = auth.uid() AND state = 'ACTIVE')) AS needs_card;
```
- `useCheckoutStepper` hook manages: `currentStep`, `stepData` (CPF, phone, cardToken, installmentNumber, hmac), `clearsaleSessionId`.
- `clearsaleSessionId` is generated at card step mount and persists for the entire session.

**Deliverables:**
- Migration: `20260624000026_rpc_checkout_step_requirements.sql`
- `src/features/payments/hooks/useCheckoutStepper.ts`
- Test: missing CPF → CPF step shown.
- Test: complete profile + saved card → CPF/Phone steps skipped.

**Dependencies:**
- Tasks 5, 17.

**Runtime Guarantees:**
- Step requirements evaluated server-side at stepper open.
- `clearsaleSessionId` generated once per stepper session.

**Requirements covered:** 5
**Acceptance Criteria covered:** 5A.1, 5A.2, 5A.3

---

### 51. [ ] Implement CPF Collection Step + Client/Server Validation

**Description:**
Implement the CPF collection step component with client-side format validation (check digit algorithm) and server-side persistence. Valid CPF is persisted to `client_profiles_private` immediately; invalid CPF produces a field-level error and blocks step advancement.

**Responsibilities:**
- Validate CPF format: 11 digits, valid check digits (Luhn-like algorithm).
- Client-side validation on submit.
- Server-side validation in the EF.
- Persist valid CPF to `client_profiles_private.cpf`.
- Display descriptive field-level error on invalid CPF.
- Block stepper advancement on validation failure.

**Implementation Details:**
```typescript
// CPF validation utility
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  // Standard CPF check digit algorithm
  const calc = (slice: number[], factor: number) =>
    slice.reduce((acc, d, i) => acc + d * (factor - i), 0) % 11;
  const d1 = calc(digits.split('').slice(0, 9).map(Number), 10);
  const v1 = d1 < 2 ? 0 : 11 - d1;
  const d2 = calc(digits.split('').slice(0, 10).map(Number), 11);
  const v2 = d2 < 2 ? 0 : 11 - d2;
  return v1 === parseInt(digits[9]) && v2 === parseInt(digits[10]);
}
```
- Component: `src/features/payments/components/checkout-stepper/cpf-step.tsx`
- Uses React Hook Form + Zod schema for form management.
- On valid CPF: PATCH `client_profiles_private` via API layer.
- CPF step does NOT reappear in subsequent acceptance flows once persisted.

**Deliverables:**
- `src/features/payments/components/checkout-stepper/cpf-step.tsx`
- `src/features/payments/utils/cpf-validator.ts`
- Unit test: invalid CPF (all same digits) → validation fails.
- Unit test: valid CPF → validation passes.

**Dependencies:**
- Task 50.

**Requirements covered:** 5
**Acceptance Criteria covered:** 5A.2, 5A.3

---

### 52. [ ] Implement ClearSale SDK Injection at Card Step Mount

**Description:**
Implement the ClearSale Browser/WebView SDK initialization at the card step component mount. A UUID v4 is generated as the `clearsaleSessionId` on every card step mount. The SDK is loaded asynchronously (non-blocking). `VITE_CLEARSALE_APP_KEY` is read from the Vite environment. The `sessionId` is stable for the entire checkout session — it MUST NOT regenerate on re-renders.

**Responsibilities:**
- Generate `clearsaleSessionId = crypto.randomUUID()` on card step component mount.
- Store in React `useRef` (stable across re-renders, not triggers re-render).
- Inject ClearSale async loader script on mount (design §4.2.2 exact snippet).
- Initialize with `csdp('app', VITE_CLEARSALE_APP_KEY)` and `csdp('sessionid', clearsaleSessionId)`.
- On script load failure: `logger.warn('clearsale_sdk_load_failed')`; continue checkout.
- Pass `clearsaleSessionId` to parent stepper state via callback.
- MUST NOT use React Native SDK.

**Implementation Details:**
```tsx
// src/features/payments/components/checkout-stepper/card-step.tsx

export function CardStep({ onSessionIdGenerated }: { onSessionIdGenerated: (id: string) => void }) {
  const clearsaleSessionIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    const sessionId = clearsaleSessionIdRef.current;
    onSessionIdGenerated(sessionId); // propagate to stepper state

    // Async SDK injection
    const script = document.createElement('script');
    script.async = true;
    script.src = '//device.clearsale.com.br/p/fp.js';
    script.onload = () => {
      (window as any).csdp?.('app', import.meta.env.VITE_CLEARSALE_APP_KEY);
      (window as any).csdp?.('sessionid', sessionId);
    };
    script.onerror = () => {
      logger.warn('clearsale_sdk_load_failed', { session_id: sessionId });
    };
    document.head.appendChild(script);

    return () => { document.head.removeChild(script); };
  }, []); // Empty deps: run only on mount
```
- `useRef` (not `useState`) ensures the session ID is stable across re-renders without causing re-renders.
- New UUID generated on every MOUNT (not re-render) — consistent with ClearSale requirement that re-entry generates a fresh session.

**Deliverables:**
- `src/features/payments/components/checkout-stepper/card-step.tsx`
- `VITE_CLEARSALE_APP_KEY` added to `.env.example`.
- Test: same `clearsaleSessionId` across re-renders.
- Test: new `clearsaleSessionId` on unmount + remount.
- Test: SDK load failure → WARN logged; checkout continues.

**Dependencies:**
- Task 50.

**Runtime Guarantees:**
- `clearsaleSessionId` stable for entire checkout session.
- New session on checkout re-entry (unmount + remount).
- SDK load failure is non-blocking.

**Security Considerations:**
- `VITE_CLEARSALE_APP_KEY` is non-secret; safe in browser bundle.
- `clearsaleSessionId` is a client-generated UUID; not a security credential.

**Requirements covered:** 5, 31
**Acceptance Criteria covered:** 5A.8, 5A.9, 31A.1, 31A.2, 31A.3, 31A.4, 31A.5

---

### 53. [ ] Implement New Card Form Component — PCI-Compliant

**Description:**
Implement the new card form component that collects card data for tokenization. Raw card data MUST be transmitted only to `tokenize-payment-card` and MUST NOT be stored in React Query cache, IndexedDB, or any browser storage. The form MUST be cleared after successful tokenization.

**Responsibilities:**
- Collect: card number (16 digits, formatted as `XXXX XXXX XXXX XXXX`), expiry month/year, CVV, cardholder name, billing address fields.
- Client-side validation: Luhn algorithm for card number; expiry in the future; CVV 3-4 digits.
- On submit: invoke `tokenize-payment-card` EF via API layer.
- Clear all card fields from form state immediately after successful tokenization.
- TanStack Query `gcTime: 0` for any card-related queries — prevent caching.
- Display `errors[].message` from gateway on tokenization failure.
- Reuse component from profile screen (no duplicate card form components).

**Implementation Details:**
- Component: `src/features/payments/components/checkout-stepper/card-form.tsx`
- React Hook Form with Zod schema validation.
- `gcTime: 0, staleTime: 0` on `useMutation` for tokenization.
- Card number input: mask as user types (`XXXX XXXX XXXX XXXX`); send digits-only to EF.
- Billing address: logradouro, número, complemento, bairro, cidade, estado, CEP.

**Deliverables:**
- `src/features/payments/components/checkout-stepper/card-form.tsx`
- `src/features/payments/api/tokenize-card.api.ts`
- Test: card number formatting (spaces inserted at correct positions).
- Test: Luhn validation rejects invalid card numbers.
- Test: form state cleared after tokenization success.

**Dependencies:**
- Task 31.

**Runtime Guarantees:**
- No card data in any browser storage after form submit.
- `gcTime: 0` prevents TanStack Query from caching card mutation data.

**Security Considerations:**
- Card fields cleared immediately after tokenization success.
- No logging of card fields.

**Requirements covered:** 5, 6, 24
**Acceptance Criteria covered:** 5A.5, 6A.1, 24A.1

---

### 54. [ ] Implement Saved Card Selection + Installment Selector Components

**Description:**
Implement the saved card selection component and installment selector. The saved card list displays all `ACTIVE` tokens for the client. The installment selector calls `calculate-installment-options` EF, displays fee-inclusive amounts per installment option, and stores the HMAC.

**Responsibilities (Card Selection):**
- Display: masked number (`•••• XXXX`), brand icon, expiry month/year.
- Provide "Add new card" option that renders `CardForm`.
- On selection: pass `card_brand` to installment step.

**Responsibilities (Installment Selector):**
- On mount: call `calculate-installment-options` EF with `proposal_id`, `service_id`, `card_brand`.
- Display: `{n}x de R$ {installment_amount}` and `Total com taxas: R$ {total_with_fees}`.
- Display fee disclosure note.
- On selection: store `installment_number` and `installment_selection_hmac` in stepper state.
- On `INSTALLMENT_SIGNATURE_EXPIRED` from `accept-proposal`: re-call `calculate-installment-options` with preserved card token.

**Deliverables:**
- `src/features/payments/components/checkout-stepper/saved-card-selector.tsx`
- `src/features/payments/components/installment-selector.tsx`
- Test: `INSTALLMENT_SIGNATURE_EXPIRED` → re-fetches options; preserves card token.

**Dependencies:**
- Tasks 30, 50, 53.

**Requirements covered:** 5, 7, 27
**Acceptance Criteria covered:** 5A.6, 5A.7, 7A.1, 27A.3

---

### 55. [ ] Implement Payment Trust Disclosure + Accept-Proposal Confirmation Step

**Description:**
Implement the payment trust disclosure component and the final confirmation step. The disclosure MUST be visible before the client confirms. The confirmation step shows when the card will be charged (conditional on emergency scheduling). On confirmation: submit `accept-proposal` EF.

**Responsibilities (Trust Disclosure):**
- Display: payment partner notice, "Termos de Uso" tappable link (opens in browser), tokenization notice, ToS acceptance statement.
- Visually prominent placement (not small print).

**Responsibilities (Confirmation Step):**
- Show service summary, installment breakdown, total with fees.
- Charge timing disclosure: if `service_scheduled_at - now() >= 48h`: show `charge_scheduled_at` date; else show "charge within next few hours".
- On "Confirm": submit `accept-proposal` payload (all required fields including `clearsale_session_id`).
- On `INSTALLMENT_SIGNATURE_EXPIRED`: re-open installment step; preserve card token.
- On success: navigate to service detail screen.

**Implementation Details:**
- Component: `src/features/payments/components/payment-trust-disclosure.tsx`
- `accept-proposal` payload must include ALL fields from Req 8 AC1.
- Charge timing computed client-side from `scheduled_date` field in stepper.
- `Termos de Uso` link: opens in system browser (`Capacitor.Browser.open()`).

**Deliverables:**
- `src/features/payments/components/payment-trust-disclosure.tsx`
- `src/features/payments/components/checkout-stepper/confirmation-step.tsx`
- Test: emergency scheduling → "charge within hours" disclosure shown.
- Test: standard scheduling → specific `charge_scheduled_at` date shown.

**Dependencies:**
- Tasks 32, 50, 52, 54.

**Requirements covered:** 27
**Acceptance Criteria covered:** 27A.1, 27A.2, 27A.3, 27A.4

---

### 56. [ ] Implement Saved Card Management UI (Profile Screen)

**Description:**
Implement the saved card management section in the client profile screen. Clients can view, add (reusing the card form component), and remove saved cards. Removal is blocked if the card is linked to an active payment schedule.

**Responsibilities:**
- Fetch and display `payment_tokens WHERE client_id = auth.uid() AND state = 'ACTIVE'`.
- "Adicionar Cartão": reuse `CardForm` component (no duplicate).
- "Remover": check for linked `SCHEDULED`/`FAILED` schedules.
  - If linked: warn user and require assigning replacement card to the affected service before removal.
  - If unlinked: SET `payment_tokens.state = 'REVOKED'`.
- No gateway API call on removal.

**Deliverables:**
- `src/features/payments/components/saved-cards/saved-cards-list.tsx`
- `src/features/payments/hooks/useSavedCards.ts`
- Test: card linked to SCHEDULED schedule → removal blocked with warning.
- Test: unlinked card → removed (REVOKED); disappears from list.

**Dependencies:**
- Task 53.

**Runtime Guarantees:**
- Token REVOKED in DB; gateway retains token validity (Renovi won't use it).

**Requirements covered:** 28
**Acceptance Criteria covered:** 28A.1, 28A.2, 28A.3, 28A.4

---

### 57. [ ] Implement Manual Payment Recovery UI + Flow

**Description:**
Implement the manual payment recovery UI in the service detail screen. The "Efetuar Pagamento" button is shown only when `payment_schedules.state ∈ {FAILED, FAILED_PERMANENT}`. On tap: shows current card, installment, fee-inclusive amount, change card option. On confirm: calls `manual-charge-payment` EF with fresh ClearSale session.

**Responsibilities:**
- Button visibility: show ONLY for `FAILED` or `FAILED_PERMANENT` states.
- Hidden for: `SCHEDULED`, `PROCESSING`, `PAID`, `CANCELLED`, `IN_ANALYSIS`.
- Manual payment screen: generate fresh `clearsaleSessionId` (new UUID on mount).
- Initialize ClearSale SDK with new session ID.
- Show fee-inclusive charge amount (call `calculate-installment-options`).
- On terminal error: show error reason in Portuguese + "Try with different card" + "Contact support" options.
- On `SERVICE_AUTO_CANCELLED` (409): inform client service was cancelled.

**Deliverables:**
- `src/features/payments/components/manual-payment-button.tsx`
- `src/features/payments/components/manual-payment-modal.tsx`
- Test: button hidden for SCHEDULED/PAID/CANCELLED states.
- Test: fresh `clearsaleSessionId` generated on modal mount.
- Test: terminal error → "Try different card" option shown.

**Dependencies:**
- Tasks 34, 52.

**Runtime Guarantees:**
- Fresh ClearSale session per manual retry.
- `SERVICE_AUTO_CANCELLED` handled gracefully.

**Requirements covered:** 13, 31
**Acceptance Criteria covered:** 13A.1, 13A.2, 13A.3, 13A.4, 13A.5, 13A.6, 31A.8

---

### 58. [ ] Implement Provider KYC Onboarding Form (CPF + CNPJ Variants)

**Description:**
Implement the provider KYC onboarding form and the blocking credentialing-pending screen. The form collects all required fields for CPF and CNPJ entity types, validates them client-side, uploads document files to Supabase Storage, and calls `dispatch-kyc-email`.

**Responsibilities:**
- Blocking screen shown on first app access when `onboarding_status = 'PENDING_DOCUMENTS'`.
- CPF form: full_name, CPF (validated), phone, email, bank fields, identity doc upload, address proof upload.
- CNPJ form: all CPF fields + razão social, nome fantasia, CNPJ (validated), legal rep fields, corporate charter upload, legal rep doc upload.
- Document upload: Supabase Storage; return URL for KYC submission.
- On submit: call `dispatch-kyc-email` EF.
- Show "submitting..." state until `email_dispatched_at` is non-NULL.

**Deliverables:**
- `src/features/payments/components/provider-kyc-form.tsx`
- `src/features/payments/utils/cnpj-validator.ts`
- Test: invalid CNPJ → form validation fails before submission.
- Test: CPF entity type → CNPJ-only fields hidden.

**Dependencies:**
- Task 36.

**Requirements covered:** 3
**Acceptance Criteria covered:** 3A.1, 3A.2, 3A.3

---

## Phase 10: Observability & Auditability

---

### 59. [ ] Sentry Initialization in All Payment Edge Functions

**Description:**
Ensure Sentry is properly initialized with a scoped transaction in every payment Edge Function. Each invocation MUST create a Sentry transaction with the canonical tags: `service_id`, `gateway_slug`, `environment`.

**Responsibilities:**
- Shared Sentry initialization utility in `_shared/observability/sentry.ts`.
- Initialize transaction at EF entry point.
- Set tags: `service_id`, `gateway_slug`, `environment` (from Deno.env).
- Finalize transaction on EF exit (success or error).
- All EFs import and use this shared utility.

**Implementation Details:**
```typescript
// _shared/observability/sentry.ts
export function initPaymentTransaction(name: string, context: {
  service_id?: string;
  gateway_slug?: string;
}) {
  Sentry.init({ dsn: Deno.env.get('SENTRY_DSN'), environment: Deno.env.get('ENVIRONMENT') });
  const transaction = Sentry.startTransaction({ name, tags: context });
  return transaction;
}
```
- `SENTRY_DSN` and `ENVIRONMENT` from Supabase project secrets.

**Deliverables:**
- `supabase/functions/_shared/observability/sentry.ts`
- Sentry initialization in all 14 payment Edge Functions.
- Test: Sentry transaction created on each EF invocation.

**Dependencies:**
- Tasks 30-43.

**Requirements covered:** 21
**Acceptance Criteria covered:** 21A.1

---

### 60. [ ] Implement Structured Logging with Correlation IDs

**Description:**
Implement structured logging throughout all payment Edge Functions using the shared `logger` utility. All log entries MUST carry `service_id` as the primary correlation key, plus `schedule_id`, `gateway_slug`, and `error_code` when applicable.

**Responsibilities:**
- Confirm `logger` utility in `_shared/` emits JSON-structured logs.
- Add `service_id` tag to every log entry in payment EFs.
- Define mandatory log event types: `charge_attempt_started`, `charge_attempt_completed`, `charge_attempt_failed`, `webhook_received`, `webhook_processed`, `orphan_recovered`.
- Log webhook events with: `event_type`, `provider_event_id`, `processing_duration_ms`, `outcome`.

**Implementation Details:**
```typescript
logger.info('charge_attempt_started', {
  service_id: schedule.contracted_service_id,
  schedule_id: schedule.id,
  attempt_number: schedule.automatic_attempt_count,
  gateway_slug: schedule.gateway_slug,
  charge_amount: chargeAmount.toString(),
  initiator: 'cron'
});
```

**Deliverables:**
- Structured log audit: all payment EFs emit required fields.
- Log schema documentation for each event type.

**Dependencies:**
- Tasks 37-43, 44-49.

**Requirements covered:** 21, 22
**Acceptance Criteria covered:** 21A.1, 21A.2

---

### 61. [ ] Implement Sentry Spans for Gateway Calls + Latency Metrics

**Description:**
Instrument all gateway API calls with Sentry spans. Each `chargeCreate`, `getTransaction`, `tokenizeCard`, `refundTransaction`, `tokenAuth`, and `getProviderCredentials` call MUST emit a Sentry span with latency and outcome.

**Responsibilities:**
- Span on every `adapter.*` call with: `gateway_latency_ms`, mutation/query name, HTTP status, `transactionState` (if applicable).
- Span finalized with success/error status.
- `FAILED_PERMANENT` transition: emit Sentry WARNING with all historical `failure_code` values.
- `tokenAuth` failure: CRITICAL Sentry.

**Implementation Details:**
```typescript
const start = Date.now();
const result = await adapter.createCharge(input);
const latency = Date.now() - start;

Sentry.addBreadcrumb({
  category: 'gateway',
  message: 'chargeCreate',
  data: { latency_ms: latency, transaction_state: result.transactionState, charge_amount: input.amount }
});
```

**Deliverables:**
- Sentry span instrumentation in `NetCredAdapter` methods.
- Test: Sentry span created on each adapter method call.

**Dependencies:**
- Tasks 27, 28, 59.

**Requirements covered:** 21
**Acceptance Criteria covered:** 21A.2, 21A.3, 21A.4

---

### 62. [ ] CRITICAL Alert Rules — tokenAuth Failure, Dead-Letter, Sandbox

**Description:**
Implement the three CRITICAL alert rules that require immediate on-call notification. These are non-negotiable production safety requirements.

**Responsibilities:**
- `tokenAuth` failure → CRITICAL Sentry; `{ gateway_slug: 'netcred', error_type: 'AUTH_FAILURE' }`; blocks ALL payment processing.
- Webhook `DEAD_LETTER` → CRITICAL Sentry; notification within 5 minutes.
- Sandbox credentials in production → CRITICAL Sentry; halt ALL execution immediately.
- Sentry alerting rule: route CRITICAL events to on-call channel (PagerDuty/Slack).

**Implementation Details:**
- `tokenAuth` failure: `Sentry.captureMessage('NETCRED_AUTH_FAILURE', { level: 'fatal', ... })`.
- Dead-letter: `Sentry.captureMessage('WEBHOOK_DEAD_LETTER', { level: 'fatal', extra: { event_id, event_type, failure_reason } })`.
- Sandbox: `Sentry.captureMessage('SANDBOX_CREDENTIALS_IN_PRODUCTION', { level: 'fatal' })`.
- Sentry project alert rule: `level:fatal` → notify on-call within 5 minutes.

**Deliverables:**
- Sentry alert rule configuration.
- Documentation: escalation runbook for each CRITICAL scenario.
- Test: sandbox assertion fires CRITICAL and aborts charge.

**Dependencies:**
- Tasks 26, 49, 59.

**Requirements covered:** 2, 19, 21
**Acceptance Criteria covered:** 2A.4, 2A.5, 19A.3, 21A.5, 21A.6

---

### 63. [ ] Audit Log Event Catalog — Completeness Verification

**Description:**
Verify that all required `payment_audit_log` event types from design §10.3 are emitted in the correct context. This is a verification task that produces a traceability matrix mapping each event type to the Edge Function and RPC that produces it.

**Responsibilities:**
- List all 17+ required `event_type` values from design §10.3.
- Trace each to its producing Edge Function or RPC.
- Confirm each is emitted in the SAME TX as the corresponding state change.
- Confirm `actor` field is correct for each.
- Confirm `metadata` JSONB contains required fields for each event type.

**Implementation Details:**
Traceability matrix (sample):

| event_type | Produced In | TX? | Actor |
|---|---|---|---|
| `CHARGE_SCHEDULED` | `accept_proposal_rpc()` | Yes | client |
| `PAYMENT_TERMS_ACCEPTED` | `accept_proposal_rpc()` | Yes | client |
| `CHARGE_ATTEMPT_STARTED` | `schedule-netcred-charges` EF | Yes | cron |
| `CHARGE_PAID` | `schedule-netcred-charges` EF | Yes | cron |
| `CHARGE_FAILED` | `schedule-netcred-charges` EF | Yes | cron |
| `ORPHAN_RECOVERED` | `recover_orphaned_payment_schedules()` RPC | Yes | system |
| `AUTO_CANCELLED` | `auto_cancel_services_rpc()` | Yes | system |
| `PROVIDER_ACTIVATED` | `detect-netcred-onboarding` EF | Yes | system |
| `REFUND_SUBMITTED` | `process-refund` EF | Yes | client |
| `WEBHOOK_PROCESSED` | `netcred-webhook` EF handlers | Yes | webhook |

**Deliverables:**
- Audit event traceability matrix document.
- Integration test suite: all 17 event types produced in correct contexts.

**Dependencies:**
- Tasks 18-49 (all RPCs and EFs).

**Requirements covered:** 22
**Acceptance Criteria covered:** 22A.1, 22A.2, 22A.3, 22A.4

---

## Phase 11: Recovery & Reliability

---

### 64. [ ] Orphan Recovery Correctness — Lease TTL Validation + Edge Cases

**Description:**
Validate orphan recovery semantics end-to-end. This task covers the complete lease lifecycle: acquisition → crash simulation → janitor detection → recovery → re-processing. Edge cases include: EF crash after lease acquisition but before gateway call; EF crash after gateway success but before state commit; concurrent janitor + late EF commit.

**Responsibilities:**
- Test: EF crashes after lease acquired, before gateway call → janitor recovers after TTL.
- Test: EF crashes after PAID response, before DB commit → janitor recovers; next cron calls `getTransaction` and reconciles as PAID.
- Test: `locked_until = now() + 10min` from `platform_constants`; janitor only runs after expiry.
- Test: `attempt_count = 0` after crash → recovered to `SCHEDULED`.
- Test: `attempt_count > 0` after crash → recovered to `FAILED` with `next_retry_at`.
- Document recovery window: max delay = lease TTL (10min) + janitor interval (30min) = 40min max.

**Implementation Details:**
- Recovery window = `payment_lease_duration_minutes + reconciliation_poll_interval_minutes` = max 40 minutes from crash to next cron attempt.
- Late commit scenario: if EF commits after janitor has recovered, the `state = 'SCHEDULED'` UPDATE in janitor runs first; EF's `state = 'PAID'` UPDATE occurs after — this is valid since state machine trigger validates `SCHEDULED → PAID` (which is valid via PROCESSING). Actually this edge case needs special handling: the EF commit must verify `state = 'PROCESSING'` before updating to `PAID`, otherwise abort.
- Add `WHERE state = 'PROCESSING' AND id = :schedule_id` to all final state commit UPDATEs.

**Deliverables:**
- Integration test suite for orphan recovery scenarios.
- Migration: add `WHERE state = 'PROCESSING'` guard to charge commit UPDATEs.

**Dependencies:**
- Tasks 19, 37.

**Runtime Guarantees:**
- Max recovery delay: 40 minutes.
- Late EF commit guard prevents stale state overwrite.
- `getTransaction` reconciliation on next retry.

**Requirements covered:** 23
**Acceptance Criteria covered:** 23A.2

---

### 65. [ ] `referenceCode` Conflict Resolution — `getTransaction` Reconciliation

**Description:**
Validate and test the `referenceCode` conflict resolution flow in the charge execution cron. When a second `chargeCreate` is issued for a `referenceCode` that already exists at the gateway (due to a prior timed-out attempt), the adapter MUST detect the conflict, call `getTransaction`, and reconcile without issuing a new charge.

**Responsibilities:**
- Test: first charge times out → FAILED (janitor recovers).
- Test: second charge attempt → `getTransaction` called first → returns PAID → reconcile as success.
- Test: second charge attempt → `getTransaction` returns null → new `chargeCreate` issued.
- Test: adapter receives `referenceCode` conflict error → calls `getTransaction` → applies reconciled state.

**Implementation Details:**
- The reconciliation check MUST run on EVERY retry attempt when `automatic_attempt_count > 1`, not only on explicit `REFERENCE_CODE_CONFLICT` error.
- `getTransaction(referenceCode = contracted_service_id)` is a defensive check that prevents blind re-charging.

**Deliverables:**
- Integration test: timeout recovery flow → no double charge.
- `executeCharge()` function in charge EF with explicit reconciliation logic.

**Dependencies:**
- Tasks 27, 37.

**Runtime Guarantees:**
- No second charge issued if prior charge exists at gateway.
- Reconciliation handles all gateway states (PAID, REJECTED, null).

**Requirements covered:** 23, 10
**Acceptance Criteria covered:** 23A.3, 10A.8, 10A.9

---

### 66. [ ] Dead-Letter Manual Recovery Runbook + Operator Tooling

**Description:**
Implement the operational tooling for manually resetting dead-lettered webhook events and create the operations runbook for all manual recovery scenarios.

**Responsibilities:**
- Implement operator RPC `reset_dead_letter_event(event_id TEXT)` that sets `state='RECEIVED'`, `retry_count=0`.
- Document runbook for: dead-letter reset, orphaned PROCESSING records, stale REFUND_REQUESTED, sandbox credentials, provider multiple NetCred edges.
- Implement diagnostic query: `payment_audit_log` full lifecycle reconstruction by `service_id`.

**Implementation Details:**
```sql
CREATE OR REPLACE FUNCTION reset_dead_letter_event(p_event_id TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE payment_webhook_events
  SET state = 'RECEIVED', retry_count = 0, next_retry_at = now(), failure_reason = NULL
  WHERE id = p_event_id AND state = 'DEAD_LETTER';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND_OR_NOT_DEAD_LETTER';
  END IF;
END;
$$;
```

**Deliverables:**
- Migration: `20260624000027_rpc_operator_tools.sql`
- `docs/payment-system/runbooks/dead-letter-recovery.md`
- `docs/payment-system/runbooks/orphan-recovery.md`
- Diagnostic query: full lifecycle from `service_id`.

**Dependencies:**
- Tasks 10, 49.

**Requirements covered:** 19, 8.3 (Design — Manual Operations)
**Acceptance Criteria covered:** 19A.4

---

### 67. [ ] `platform_constants` Fallback Defaults + WARN on Missing Key

**Description:**
Implement the fallback default mechanism for all `platform_constants` reads in Edge Functions and RPCs. Every read MUST have a safe fallback value. Missing keys MUST emit a WARN log — they MUST NOT cause runtime exceptions.

**Responsibilities:**
- Implement `getConstantWithFallback(key: string, defaultValue: number): number` utility.
- Apply to ALL constant reads in all EFs and RPCs.
- Log WARN with key name and default used.
- Unit test: missing key → default used + WARN emitted.

**Implementation Details:**
```typescript
// _shared/payment/constants.ts
export async function loadPlatformConstants(supabase: SupabaseClient): Promise<PlatformConstants> {
  const { data } = await supabase.from('platform_constants').select('key, value');
  const map = new Map(data?.map(r => [r.key, parseFloat(r.value)]) ?? []);

  const get = (key: string, fallback: number) => {
    if (!map.has(key)) {
      logger.warn('platform_constant_missing', { key, fallback });
      return fallback;
    }
    return map.get(key)!;
  };

  return {
    max_charge_attempts: get('max_charge_attempts', 3),
    charge_retry_interval_minutes: get('charge_retry_interval_minutes', 30),
    payment_lease_duration_minutes: get('payment_lease_duration_minutes', 10),
    // ... all 16 constants
  };
}
```

**Deliverables:**
- `supabase/functions/_shared/payment/constants.ts`
- Unit test: all 16 constants have correct fallback values.

**Dependencies:**
- Task 4.

**Requirements covered:** 25
**Acceptance Criteria covered:** 25A.4

---

## Phase 12: Security & Isolation

---

### 68. [ ] PCI DSS Audit — Schema Compliance + No PAN/CVV Columns

**Description:**
Perform and document the PCI DSS schema compliance audit. Confirm `payment_tokens` contains NO raw PAN or CVV columns. Confirm all sensitive fields are gateway-issued references. Confirm no card data appears in logs, React Query cache, or IndexedDB.

**Responsibilities:**
- Schema audit: `\d payment_tokens` — verify no `pan`, `card_number` (full), `cvv`, `cvc`, `security_code` columns.
- Log audit: confirm `tokenize-payment-card` EF excludes card fields from all `logger.*` calls.
- React Query audit: confirm `gcTime: 0` on card-related mutations.
- IndexedDB audit: confirm no card-related keys in any Capacitor/PWA local storage.
- Generate PCI compliance evidence document.

**Deliverables:**
- `docs/payment-system/pci-compliance-audit.md`
- Schema audit SQL confirming no PAN/CVV columns.
- Code audit confirming no card data logging.

**Dependencies:**
- Tasks 5, 31, 53.

**Runtime Guarantees:**
- No raw PAN/CVV in any Renovi system at any layer.

**Requirements covered:** 6, 24
**Acceptance Criteria covered:** 24A.1, 24A.2, 24A.3

---

### 69. [ ] Webhook HMAC Rate Limiting + Anti-Abuse

**Description:**
Implement webhook endpoint rate limiting to prevent HMAC brute-force attacks. The `netcred-webhook` endpoint MUST be rate-limited by IP using `platform_rate_limits`. Invalid signature attempts from a single IP above threshold MUST be blocked.

**Responsibilities:**
- Implement `checkIPRateLimit(ip: string, endpoint: string)` using `platform_rate_limits` table.
- Apply to `netcred-webhook` entry point.
- On rate limit exceeded: return HTTP 429; emit WARN Sentry.
- Tunable thresholds via `platform_rate_limits`.

**Deliverables:**
- `platform_rate_limits` table migration.
- Rate limiting utility in `_shared/security/rate-limit.ts`.
- Integration in `netcred-webhook/index.ts`.

**Dependencies:**
- Task 44.

**Requirements covered:** 24
**Acceptance Criteria covered:** 24A.4

---

### 70. [ ] Installment HMAC Expiry + Tamper Prevention Audit

**Description:**
Audit and test the complete HMAC signing/validation lifecycle for installment selections. Verify that expired HMACs are correctly rejected, tampered amounts are rejected, and the constant-time comparison prevents timing attacks.

**Responsibilities:**
- Test: expired HMAC (computed_at + 11min) → HTTP 400 `INSTALLMENT_SIGNATURE_EXPIRED`.
- Test: modified `base_amount` in payload → HMAC mismatch → HTTP 400 `INVALID_INSTALLMENT_SIGNATURE`.
- Test: modified `installment_number` → HMAC mismatch.
- Test: `crypto.timingSafeEqual` used (no early-exit string comparison).
- Test: client receives `INSTALLMENT_SIGNATURE_EXPIRED` → re-opens installment step, preserves card token.

**Deliverables:**
- Test suite: `supabase/functions/accept-proposal/hmac.test.ts`
- Code audit: confirm `crypto.timingSafeEqual` used everywhere.

**Dependencies:**
- Tasks 30, 32.

**Requirements covered:** 7, 24
**Acceptance Criteria covered:** 7A.4, 7A.5, 24A.3, 24A.5

---

### 71. [ ] Sandbox Assertion + Secrets Management Audit

**Description:**
Audit and test the sandbox credentials assertion in `NetCredAdapter` and validate that all secrets are read from Vault exclusively — never from `.env` files, source code, or client-accessible stores.

**Responsibilities:**
- Test: `tokenAuth` response with `user.sandbox = true` in production → CRITICAL Sentry + execution abort.
- Audit: `NETCRED_USERNAME`, `NETCRED_PASSWORD`, `NETCRED_WEBHOOK_SECRET`, `INSTALLMENT_SIGNING_SECRET` — all read from Vault.
- Audit: NO secrets in `.env.production`, source code, or any committed file.
- Document secret rotation procedure (Vault update only; no migration required).

**Deliverables:**
- `docs/payment-system/secrets-management.md`
- Code audit confirming Vault-only secret access.
- Test: sandbox assertion CRITICAL alert fires.

**Dependencies:**
- Tasks 26, 28.

**Requirements covered:** 2, 24
**Acceptance Criteria covered:** 2A.5, 24A.5, 24A.6

---

### 72. [ ] Provider Marketplace Access Gate — Security Enforcement Audit

**Description:**
Audit and test all marketplace access gate RPCs to confirm that non-credentialed and suspended providers are blocked at the database level (SECURITY DEFINER RPC), not only at the client UI level.

**Responsibilities:**
- Test: `PENDING_DOCUMENTS` provider → `match_provider_jobs` returns empty.
- Test: `SUSPENDED` provider → empty result, same as PENDING_DOCUMENTS.
- Test: `ACTIVE` provider → results returned normally.
- Test: non-credentialed provider attempts chat initiation → HTTP 409 `PROVIDER_NOT_CREDENTIALED`.
- Test: non-credentialed provider attempts `accept_proposal` via API (bypassing UI) → HTTP 409.

**Deliverables:**
- Integration test suite for all access gate scenarios.
- API-level test (direct EF invocation bypassing UI).

**Dependencies:**
- Tasks 22, 32, 36.

**Requirements covered:** 29
**Acceptance Criteria covered:** 29A.1–29A.6

---

## Phase 13: Performance & Scalability

---

### 73. [ ] Index Validation + Query Plan Analysis

**Description:**
Validate all payment system indexes against their intended query patterns using `EXPLAIN ANALYZE`. Confirm the cron dequeue partial index is used for the eligibility query. Confirm stale-state index is used for reconciliation. Confirm service lookup index is used for webhook handler.

**Responsibilities:**
- `EXPLAIN ANALYZE` for cron eligibility query → must use `idx_payment_schedules_queue` (Index Scan, not Seq Scan).
- `EXPLAIN ANALYZE` for reconciliation query → must use `idx_payment_schedules_stale`.
- `EXPLAIN ANALYZE` for service lookup → must use `idx_payment_schedules_service`.
- `EXPLAIN ANALYZE` for audit log by service → must use `idx_audit_log_service`.
- `EXPLAIN ANALYZE` for onboarding cron → must use `idx_provider_accounts_status`.
- `EXPLAIN ANALYZE` for webhook dedup → must use UNIQUE constraint index.

**Deliverables:**
- `docs/payment-system/index-analysis.md` with query plans.
- Any missing or unused indexes identified and remediated.

**Dependencies:**
- Tasks 8, 10, 11, 6.

**Performance Considerations:**
- All identified query patterns MUST use index scans, not sequential scans, at production data volumes.

**Requirements covered:** 26
**Acceptance Criteria covered:** 26A.8

---

### 74. [ ] Queue Throughput + Batch Size Tuning

**Description:**
Validate and document the queue throughput capacity of the `schedule-netcred-charges` cron. Compute maximum throughput at current batch size and cron frequency. Define batch size scaling strategy for higher volumes.

**Responsibilities:**
- Document: at 4x/day + batch_size=10 → 40 schedules/day per invocation.
- For 100 services/day: `ceil(100/10) = 10` invocations per batch → requires increasing batch_size or cron frequency.
- Define scaling options: increase `charge_batch_size` via `platform_constants`; increase cron frequency (max 96x/day at 15min intervals).
- Load test: 50 concurrent schedule acquisitions → confirm no double-processing.

**Deliverables:**
- `docs/payment-system/throughput-analysis.md`
- Load test results confirming SKIP LOCKED prevents double-processing.

**Dependencies:**
- Tasks 37, 24.

**Requirements covered:** 10, 23
**Acceptance Criteria covered:** 10A.10

---

### 75. [ ] `payment_audit_log` Partitioning Strategy

**Description:**
Document and prepare the `payment_audit_log` table partitioning strategy for growth scale. At MVP scale (< 10^5 records), no partitioning is needed. At scale, monthly partitioning by `created_at` is planned.

**Responsibilities:**
- Document threshold for partitioning activation (> 10^5 records or > 1 year of data).
- Prepare migration template for monthly partition creation.
- Confirm composite index `(service_id, created_at)` remains optimal after partitioning.
- Document pg_cron job for automated partition creation (monthly pre-creation).

**Deliverables:**
- `docs/payment-system/audit-log-partitioning.md`
- Partition migration template SQL.

**Dependencies:**
- Task 11.

**Requirements covered:** 26
**Acceptance Criteria covered:** N/A (scalability preparation)

---

## Phase 14: Verification & Rollout

---

### 76. [ ] Unit Tests — Fee Formula + `calculate_charge_amount()` RPC

**Description:**
Implement comprehensive unit test coverage for the fee computation formula in both the PostgreSQL RPC and the Edge Function. Both MUST produce identical results for all brand/range/installment combinations.

**Responsibilities:**
- Test all 6 brand × range combinations for correct rate selection.
- Test all installment values 1–12.
- Test fixed fee addition.
- Test banker's rounding behavior at half-even boundary values.
- Test formula parity: EF output === RPC output for same inputs.
- Test COALESCE fallback on missing constants.

**Implementation Details:**
```typescript
// Parity test
for (const brand of ['VCC', 'MASTER', 'ELO', 'AMEX']) {
  for (let n = 1; n <= 12; n++) {
    const efResult = computeInstallmentOptions(1000.00, brand, constants)[n-1];
    const rpcResult = await supabase.rpc('calculate_charge_amount', { p_base_amount: 1000.00, p_installment_n: n, p_token_id: tokenIdWithBrand(brand) });
    expect(efResult.installment_amount).toEqual(rpcResult.data);
  }
}
```

**Deliverables:**
- `src/features/payments/utils/fee-calculator.test.ts`
- `supabase/functions/calculate-installment-options/fee-calculator.test.ts`
- Test: EF and RPC produce identical values for all combinations.

**Dependencies:**
- Tasks 17, 30.

**Requirements covered:** 7, 25
**Acceptance Criteria covered:** 7A.3, 7A.6, 25A.5

---

### 77. [ ] Integration Tests — Charge Cron State Machine End-to-End

**Description:**
Implement end-to-end integration tests for the charge execution cron covering all state transition paths.

**Responsibilities:**
- Test: `SCHEDULED` → `PROCESSING` (lease acquired) → `PAID` (cron commits).
- Test: `SCHEDULED` → `PROCESSING` → `IN_ANALYSIS` → `PAID` (webhook).
- Test: `SCHEDULED` → `PROCESSING` → `FAILED` (retryable) → `PROCESSING` (retry) → `FAILED_PERMANENT` (max attempts).
- Test: `SCHEDULED` → `PROCESSING` → `FAILED_PERMANENT` (terminal error on first attempt, no retry budget consumed).
- Test: emergency scheduling → charge_scheduled_at = now().
- Test: `auto_cancel_services_rpc` at T-12h after `FAILED_PERMANENT`.
- Test: audit log entries present for each transition.
- Test: `payment_attempts` record created per attempt.
- Test: `payment_events` emitted per transition.

**Deliverables:**
- `supabase/functions/schedule-netcred-charges/integration.test.ts`
- Mock NetCred API server for tests.
- State transition coverage report.

**Dependencies:**
- Tasks 37, 20, 17.

**Requirements covered:** 10, 11, 14
**Acceptance Criteria covered:** 10A.1–10A.9, 11A.1–11A.7

---

### 78. [ ] Concurrency Tests — SKIP LOCKED + Lease Race Conditions

**Description:**
Implement concurrency tests verifying the SKIP LOCKED dequeue semantics and lease collision scenarios.

**Responsibilities:**
- Test: two concurrent cron invocations on same eligible schedule → only one acquires lease; second skips.
- Test: manual payment attempt while cron holds lease → manual charge returns HTTP 409.
- Test: cron holds lease; lease expires; janitor recovers; cron re-processes on next run.
- Test: concurrent `accept_proposal` with same `proposal_id` → second returns HTTP 200 with existing IDs.
- Test: concurrent `tokenAuth` refresh → only one `tokenAuth` call issued.

**Deliverables:**
- `src/features/payments/__tests__/concurrency.test.ts`
- Concurrency test harness (multiple parallel Supabase client instances).

**Dependencies:**
- Tasks 18, 26, 37, 34.

**Requirements covered:** 23
**Acceptance Criteria covered:** 23A.1–23A.5

---

### 79. [ ] Webhook Deduplication + Out-of-Order Delivery Tests

**Description:**
Implement tests for webhook deduplication and out-of-order event delivery.

**Responsibilities:**
- Test: same `provider_event_id` delivered twice → second insert triggers UNIQUE conflict; `is_duplicate = true`; HTTP 200; no reprocessing.
- Test: `TRANSACTION_REFUND` arrives before `TRANSACTION_CAPTURE` (out-of-order) → `IN_ANALYSIS` schedule processes refund correctly (or skips gracefully).
- Test: `TRANSACTION_CAPTURE` arrives for already-`PAID` schedule → state unchanged; event marked PROCESSED.
- Test: webhook retry with DEAD_LETTER reset → manual reset → next cron re-processes; idempotency prevents duplicate transition.

**Deliverables:**
- `supabase/functions/netcred-webhook/dedup.test.ts`
- Out-of-order event test scenarios.

**Dependencies:**
- Tasks 44, 45, 47, 49.

**Requirements covered:** 17
**Acceptance Criteria covered:** 17A.1–17A.5

---

### 80. [ ] Feature Flags + Phased Rollout Strategy

**Description:**
Implement feature flag gating for the payment system and define the phased rollout plan. The entire payment flow MUST be gated behind a feature flag until explicitly enabled for production.

**Responsibilities:**
- Implement `feature_flag('payment_system_v1')` gate in `accept-proposal` EF.
- Phase 1: internal team only (5% rollout via feature flag).
- Phase 2: pilot cohort (20% of new service acceptances).
- Phase 3: full rollout after 72h shadow execution validation.
- Cron jobs disabled (`active = false`) until Phase 2.
- Shadow execution: `schedule-netcred-charges` runs in dry-run mode for first 72h (log payloads without calling gateway).

**Implementation Details:**
- `platform_constants.payment_system_rollout_percentage` (0–100) controls rollout percentage.
- `accept-proposal` reads constant; if `random() * 100 > rollout_percentage`, return `feature_not_available`.
- Shadow mode: `platform_constants.charge_cron_dry_run = 'true'` enables logging-only mode.

**Deliverables:**
- Feature flag implementation in `accept-proposal` EF.
- Shadow execution mode in `schedule-netcred-charges`.
- Rollout runbook: `docs/payment-system/rollout-plan.md`.

**Dependencies:**
- All Phase 6-8 EFs.

**Requirements covered:** All
**Acceptance Criteria covered:** Operational rollout criteria

---

### 81. [ ] Migration Safety Checklist + Backward Compatibility

**Description:**
Execute the migration safety checklist for all 27+ migrations in this backlog. Confirm each migration is reversible, non-blocking at production load, and backward compatible.

**Responsibilities:**
- Confirm all migrations are additive (no DROP, no RENAME, no ALTER COLUMN TYPE).
- Confirm all `CREATE TABLE` migrations have matching `DROP TABLE` rollback scripts.
- Confirm `CREATE INDEX CONCURRENTLY` is used for production index creation (non-blocking).
- Confirm `ALTER TABLE ... ADD COLUMN` with DEFAULT is instant (PostgreSQL 11+).
- Confirm `pg_cron` job registrations are idempotent (ON CONFLICT DO UPDATE).

**Deliverables:**
- Migration safety review checklist completed.
- `CREATE INDEX CONCURRENTLY` applied to all production index migrations.
- Rollback migration scripts for all Phase 1-2 migrations.

**Dependencies:**
- All Phase 1-2 migrations (Tasks 1-16).

**Requirements covered:** All (operational safety)
**Acceptance Criteria covered:** Operational rollout criteria

---

### 82. [ ] Production Smoke Tests + Operational Validation

**Description:**
Define and execute the production smoke test plan after initial deployment. Validates that all payment system components are operational in production before enabling the feature flag.

**Responsibilities:**
- Smoke test 1: `pg_cron` job list confirms all 8 jobs registered.
- Smoke test 2: `platform_constants` table has all 16 required keys.
- Smoke test 3: `payment_providers` has NetCred seed record.
- Smoke test 4: `calculate-installment-options` EF responds with HMAC for test proposal.
- Smoke test 5: `tokenize-payment-card` with test card → token created (sandbox).
- Smoke test 6: `accept-proposal` with test service → schedule created (dry-run mode).
- Smoke test 7: manual trigger of `schedule-netcred-charges` in dry-run mode → logs correctly without gateway call.
- Smoke test 8: synthetic webhook POST to `netcred-webhook` → HMAC validates, event persisted.
- Smoke test 9: `recover_orphaned_payment_schedules()` RPC → returns 0 (no orphans on fresh system).
- Smoke test 10: Sentry receives test event → alert rule active.

**Deliverables:**
- `docs/payment-system/smoke-test-runbook.md`
- Automated smoke test script (Deno/TypeScript).
- GO/NO-GO criteria: all 10 smoke tests pass before feature flag enabled.

**Dependencies:**
- All phases complete.

**Requirements covered:** All
**Acceptance Criteria covered:** All (production validation gate)

---

### 83. [ ] Extend `contracted_services` Schema for Payment System

**Description:**
The `contracted_services` table and `contracted_service_status` enum predate the payment system and MUST be extended before any payment RPC or EF can run. This migration is the single most critical pre-condition of the entire Phase 3 RPC layer: `auto_cancel_services_rpc()`, `mark_service_executed()`, and `accept_proposal_rpc()` all reference columns that do not exist in the current schema.

**Responsibilities:**
- Add `CONFIRMED` and `EXECUTED` values to the `contracted_service_status` enum.
- Add `service_scheduled_at` column (`TIMESTAMPTZ`) — used by T-12h auto-cancel and T-2 charge scheduling queries.
- Add `cancellation_reason` column (`TEXT`) — set by `auto_cancel_services_rpc()` and `process-refund` EF.
- Add `executed_at` column (`TIMESTAMPTZ`) — set by `mark_service_executed()`.
- Add `completed_at` column (`TIMESTAMPTZ`) — set by service completion flow (client confirm / auto-complete cron).
- Add `completed_by` column (`TEXT`, CHECK IN ('client', 'system')) — set by service completion flow.
- Update `comment on type public.contracted_service_status` to reflect the full lifecycle.
- Update the partial index on `contracted_services(provider_id, scheduled_start_date)` WHERE `status = 'PENDING_PAYMENT'` to remain valid after enum extension.

**Implementation Details:**
```sql
-- Per workspace supabase-migrations rule: edit the existing enum migration file (20260705205000_extend_contracted_service_status_enum.sql)
-- to add the two new values rather than creating a new migration, since the codebase is still in development.
-- Exception: if already deployed to production, create a new migration instead.

-- Add new enum values (idempotent: safe to run if values already exist)
ALTER TYPE public.contracted_service_status ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE public.contracted_service_status ADD VALUE IF NOT EXISTS 'EXECUTED';

COMMENT ON TYPE public.contracted_service_status IS
  'Contracted service lifecycle: PENDING_PAYMENT after accept; CONFIRMED after PAID; EXECUTED after provider marks done; COMPLETED after client confirms; CANCELLED when terminated.';

-- Extend contracted_services table with payment-required columns
ALTER TABLE public.contracted_services
  ADD COLUMN IF NOT EXISTS service_scheduled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason   TEXT,
  ADD COLUMN IF NOT EXISTS executed_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by          TEXT CHECK (completed_by IN ('client', 'system'));

COMMENT ON COLUMN public.contracted_services.service_scheduled_at IS
  'Datetime of service execution; set at accept_proposal. Drives T-2 charge_scheduled_at and T-12h auto-cancellation comparisons.';
COMMENT ON COLUMN public.contracted_services.cancellation_reason IS
  'Why the service was cancelled (NON_PAYMENT, PROVIDER_SUSPENDED, CLIENT_INITIATED, SYSTEM). Set at cancellation time.';
COMMENT ON COLUMN public.contracted_services.executed_at IS
  'When the provider marked the service as executed. NULL until mark_service_executed().';
COMMENT ON COLUMN public.contracted_services.completed_at IS
  'When the service reached COMPLETED status (client confirm or auto-complete cron).';
COMMENT ON COLUMN public.contracted_services.completed_by IS
  'Actor that triggered COMPLETED transition: client (explicit confirm) or system (auto-complete cron).';

-- Index for T-12h auto-cancel query: WHERE service_scheduled_at - now() <= 12h AND status NOT IN terminal
CREATE INDEX IF NOT EXISTS idx_contracted_services_scheduled_at
  ON public.contracted_services(service_scheduled_at)
  WHERE status IN ('PENDING_PAYMENT', 'CONFIRMED');
```

**Population of `service_scheduled_at`:**
The `accept_proposal_rpc()` (Task 18) receives `p_service_scheduled_at` (derived from the accepted `provider_proposals.suggested_slot.start_date` at acceptance time) and MUST persist it in the new column. All existing rows with `status = 'PENDING_PAYMENT'` MUST have `service_scheduled_at` backfilled from `provider_proposals` via a one-time data migration if deployed to an environment with existing data.

**Deliverables:**
- Edit `supabase/migrations/20260705205000_extend_contracted_service_status_enum.sql` to add `CONFIRMED` and `EXECUTED`.
- New migration `20260624000083_extend_contracted_services_payment_columns.sql` with the `ALTER TABLE` statements and index.
- Data backfill script for existing `PENDING_PAYMENT` rows (if pre-existing data exists).
- pgTAP test: `CONFIRMED` and `EXECUTED` enum values accepted by `status` column CHECK.
- pgTAP test: `completed_by CHECK` rejects values outside ('client', 'system').

**Dependencies:**
- None (prerequisite for Tasks 18, 20, 21, 42, 35, 47).

**Runtime Guarantees:**
- `ADD COLUMN IF NOT EXISTS` is instant on PostgreSQL 11+ (no table rewrite).
- `ADD VALUE IF NOT EXISTS` is transactional and idempotent.
- All existing rows are unaffected (new columns default to NULL).

**Failure Handling:**
- If enum extension is attempted mid-transaction with concurrent writers, PostgreSQL serializes via lock — safe.
- Rollback: `ALTER TYPE ... DROP VALUE` is not supported in PostgreSQL; rollback requires recreating the type. Document this constraint in the migration rollback guide.

**Observability:**
- After migration: `SELECT unnest(enum_range(NULL::contracted_service_status))` MUST return 5 values.

**Security Considerations:**
- No RLS change required — existing policies on `contracted_services` remain valid after schema extension.

**Performance Considerations:**
- The new partial index `idx_contracted_services_scheduled_at` supports the T-12h auto-cancel query.
- `CREATE INDEX IF NOT EXISTS` in migration; use `CONCURRENTLY` in production if table is large.

**Requirements covered:** 9, 14, 20, 32
**Acceptance Criteria covered:** 9A.1, 14A.1–14A.7, 20A.1, 32A.1–32A.5

---

### 84. [ ] Add `phone` Column to `provider_profiles_private`

**Description:**
Req 3 AC2 requires collecting the provider's `mobile phone` during KYC. Req 3 AC4 point (5) states the system MUST "update `provider_profiles_private` accordingly" after KYC submission. The current `provider_profiles_private` schema (migration `20260318100002_create_provider_profiles_private.sql`) has no `phone` column — this migration adds it. Without it, the `dispatch-kyc-email` EF (Task 36) cannot fulfil Req 3 AC4(5).

**Responsibilities:**
- Add `phone TEXT` column to `provider_profiles_private`.
- Add `legal_representative_phone TEXT` column (required for CNPJ providers per Req 3 AC3).
- Update `COMMENT ON COLUMN` accordingly.
- Update `dispatch-kyc-email` EF (Task 36) to also `UPDATE provider_profiles_private SET phone = p_phone WHERE provider_id = auth.uid()` within the same TX as the KYC submission.

**Implementation Details:**
```sql
-- Per workspace rule: edit the existing migration file 20260318100002_create_provider_profiles_private.sql
-- to add these columns to the CREATE TABLE definition.
-- OR create new migration if the file is already in production.

ALTER TABLE public.provider_profiles_private
  ADD COLUMN IF NOT EXISTS phone                    TEXT,
  ADD COLUMN IF NOT EXISTS legal_representative_phone TEXT;

COMMENT ON COLUMN public.provider_profiles_private.phone IS
  'Mobile phone collected at KYC submission (CPF and CNPJ providers).';
COMMENT ON COLUMN public.provider_profiles_private.legal_representative_phone IS
  'Legal representative phone for PJ providers; collected at CNPJ KYC.';
```

In `dispatch-kyc-email` EF (Task 36), the TX block MUST be updated to:
```sql
-- Within the same BEGIN...COMMIT as provider_kyc_submissions + provider_accounts update
UPDATE provider_profiles_private
SET phone = p_phone,
    legal_representative_phone = p_legal_representative_phone  -- NULL for CPF providers
WHERE provider_id = p_provider_id;
```

**Deliverables:**
- Edit `supabase/migrations/20260318100002_create_provider_profiles_private.sql` to add both columns.
- Update `dispatch-kyc-email` EF implementation (Task 36) to include the `provider_profiles_private` UPDATE in its TX.
- pgTAP test: KYC submission → `provider_profiles_private.phone` is populated.
- pgTAP test: CPF provider → `legal_representative_phone` remains NULL.

**Dependencies:**
- Task 36 (dispatch-kyc-email EF — must be updated accordingly).

**Runtime Guarantees:**
- `ADD COLUMN IF NOT EXISTS` is instant; no table rewrite.
- UPDATE of `provider_profiles_private` within the same TX as KYC insertion ensures atomicity.

**Security Considerations:**
- `phone` is PII (LGPD). Covered by existing RLS policy: providers can only read/update their own row.
- No new RLS policy required.

**Requirements covered:** 3
**Acceptance Criteria covered:** 3A.2, 3A.3, 3A.4 (point 5)

---

## Appendix: Requirements Traceability Matrix

| Requirement | Tasks |
|---|---|
| Req 1: PaymentProvider Interface | 25, 26, 27, 28, 29 |
| Req 2: NetCred JWT Lifecycle | 3, 26, 71 |
| Req 3: Provider KYC Collection | 6, 7, 36, 58, **84** |
| Req 4: Onboarding Detection Cron | 6, 38 |
| Req 5: Client Profile Completion | 50, 51 |
| Req 6: PCI Card Tokenization | 5, 31, 48, 53, 68 |
| Req 7: Installment Calculation + HMAC | 17, 30, 54, 70, 76 |
| Req 8: accept_proposal | 18, 32, 33 |
| Req 9: Charge Scheduling Persistence | 8, 18, 23, **83** |
| Req 10: T-2 Charge Execution Cron | 17, 24, 37, 64, 74, 77 |
| Req 11: Retry Semantics + Error Classification | 8, 29, 37, 77 |
| Req 12: Notifications | 37 (AC1, AC2, AC4, AC5), 39 (AC3, AC6→see Task 45), 40, 45 (AC6) |
| Req 13: Manual Payment Recovery | 34, 57 |
| Req 14: Auto-Cancellation T-12h | 20, 39, **83** |
| Req 15: Cancellation + Refund | 35, 47 |
| Req 16: Webhook Ingestion + Signature | 10, 44 |
| Req 17: Webhook Idempotency | 10, 29, 44, 45, 48, 79 |
| Req 18: Webhook Event Catalog | 45, 46, 47, 48 |
| Req 19: Webhook Dead Letter | 49, 62, 66 |
| Req 20: Reconciliation Polling | 41 |
| Req 21: Sentry Integration | 39 (AC7), 59, 60, 61, 62 |
| Req 22: Audit Logging | 11, 63 |
| Req 23: Concurrency Control | 8, 14, 19, 37, 64, 65, 78 |
| Req 24: PCI DSS Security | 5, 15, 16, 31, 44, 68, 69, 70, 71 |
| Req 25: Platform Constants | 4, 17, 30, 67 |
| Req 26: Payment Data Model | 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 73, 75 |
| Req 27: Checkout Trust + Security UI | 55 |
| Req 28: Saved Card Management | 5, 15, 56 |
| Req 29: Provider Marketplace Access Gate | 6, 22 (AC1, AC2, AC6), 72 |
| Req 30: Event-Driven Architecture | 12, 37, 38, 39, 40, 41, 42 |
| Req 31: ClearSale Fingerprint | 8, 32, 34, 37, 52, 57 |
| Req 32: Service Completion Flow | 21, 42, **83** |
| Req 33: Pre-Charge Notification | 23, 40 |

---

## Appendix: Task Dependency Graph (Critical Path)

```
[83] contracted_services schema extension (CONFIRMED, EXECUTED enum + new columns)
[84] provider_profiles_private.phone column
  │
  ▼ (both must be applied BEFORE any payment RPC or EF)
  │
[1] Extensions
  └─► [2] payment_providers
      ├─► [3] payment_gateway_tokens
      ├─► [5] payment_tokens
      │   └─► [8] payment_schedules ──────────────────────────────────┐
      │       ├─► [9] payment_attempts                                │
      │       ├─► [10] payment_webhook_events                         │
      │       ├─► [11] payment_audit_log                              │
      │       ├─► [12] payment_events                                 │
      │       └─► [13] webhook_processing_queue                       │
      ├─► [6] provider_accounts                                       │
      │   └─► [7] provider_kyc_submissions                            │
      └─► [4] platform_constants                                      │
                                                                      │
[14] State Trigger ◄──────────────────────────────────────────────────┘
[15-16] RLS Policies                                                   │
                                                                      │
[17] calculate_charge_amount() ◄── [4] + [5]                         │
[18] accept_proposal_rpc() ◄── [8] + [11] + [12] + [83]             │
[19] recover_orphaned() ◄── [8] + [11]                               │
[20] auto_cancel_services_rpc() ◄── [8] + [11] + [83]               │
[21] mark_service_executed() ◄── [11] + [83]                         │
[22] match_provider_jobs() ◄── [6]                                   │
[23] reschedule_charge_date() ◄── [8] + [11]                         │
                                                                      │
[24] pg_cron jobs + cron_*() wrappers (job_runs telemetry) ◄── [1] + ALL EFs
                                                                      │
[25] PaymentProvider interface                                        │
[26] refreshAuthToken ◄── [3] + [25]                                 │
[27] createCharge + getTransaction ◄── [25] + [26]                   │
[28] tokenizeCard + refund ◄── [25]                                  │
[29] Error Classification ◄── [25]                                   │
                                                                      │
[30] calculate-installment-options EF ◄── [4] + [25]                │
[31] tokenize-payment-card EF ◄── [5] + [25] + [28]                 │
[32] accept-proposal EF ◄── [18] + [30] + [31] + [83]               │
[33] update-payment-method EF ◄── [8] + [11] + [30]                 │
[34] manual-charge-payment EF ◄── [17] + [27] + [29]                │
[35] process-refund EF ◄── [8] + [11] + [28] + [83]                 │
[36] dispatch-kyc-email EF ◄── [7] + [6] + [11] + [84]              │
                                                                      │
[37] schedule-netcred-charges EF ◄── [17] + [24] + [27] + [29]      │
[38] detect-netcred-onboarding EF ◄── [6] + [28] + [11]             │
[39] auto-cancel EF ◄── [20] + [8] + [83]                           │
[40] notify-upcoming-charges EF ◄── [8] + [11]                      │
[41] reconcile-netcred-payments EF ◄── [27] + [8] + [11]            │
[42] auto-complete EF ◄── [11] + [12] + [83]                        │
[43] recover-payment-leases EF ◄── [19]                             │
                                                                      │
[44] netcred-webhook EF ◄── [10] + [29] + [13]                      │
[45-49] Webhook Handlers ◄── [8] + [11] + [44]                      │
                                                                      │
[50-58] Frontend ◄── [30] + [31] + [32] + [34] + [36]               │
                                                                      │
[59-63] Observability ◄── [30-49]                                    │
[64-67] Recovery ◄── [19] + [37] + [27]                             │
[68-72] Security ◄── [5] + [15] + [31] + [44]                       │
[73-75] Performance ◄── [8] + [10] + [11]                           │
[76-82] Verification + Rollout ◄── ALL                               │
[83] contracted_services schema ◄── PREREQUISITE (first in Phase 1)  │
[84] provider_profiles_private.phone ◄── PREREQUISITE (first in Phase 1)
```

---

*Implementation Tasks — Renovi Payment System v1.0 — 2026-06-24.*
*Generated from `payment-system-requirements.md` v1.0 and `design.md` v1.0.*
*This document MUST be updated when: (a) a new payment provider adapter is introduced, (b) new payment methods (Pix, Boleto) are activated, (c) ToS §2.2 cancellation penalties are revised, (d) pg_cron schedule changes, or (e) the NetCred webhook catalog is expanded.*
