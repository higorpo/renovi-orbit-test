# Renovi Payment System Requirements

> **Document Type:** Architecture Requirements Specification (RFC-style)  
> **Version:** 1.0  
> **Date:** 2026-06-24  
> **Status:** Active  
> **Audience:** Principal Engineers, Staff Engineers, Backend Engineers, Mobile Engineers  

---

## Context

### System Purpose

The Renovi Payment System is a payment orchestration subsystem embedded within the Orbit marketplace platform. Its primary mandate is to provide a reliable, idempotent, observable, and provider-agnostic pipeline for processing service-contract payments between marketplace clients (payers) and service providers (payees).

**Problem Statement.** When a client accepts a service proposal, the platform must: (a) securely tokenize the client's payment method without persisting raw card data, (b) collect any missing profile fields required for antifraude and gateway compliance (CPF, phone, billing address), (c) schedule a deferred charge to execute exactly 48 hours prior to the service appointment date, (d) execute said charge via a payment gateway adapter with retry semantics, (e) distribute funds to the appropriate provider account via a configurable split rule, and (f) handle all failure modes—including automatic retries, manual client recovery, partial refunds subject to cancellation penalties, and auto-cancellation at the T-12h threshold—in a fully observable and auditable manner.

**Business Objectives:**

- Guarantee that charges are executed exactly once per service contract, regardless of cron restarts, network failures, or concurrent worker invocations.
- Protect providers against service execution without payment by enforcing a charge-must-succeed-before-execution invariant.
- Minimize revenue leakage from unpaid services through automated retry and escalation flows, with auto-cancellation as a final safeguard.
- Enable provider onboarding via structured KYC collection and external gateway credentialing, gating all service delivery behind credentialing completion.
- Comply with PCI DSS data-at-rest requirements: no raw card data (PAN, CVV) is persisted in Renovi infrastructure at any layer.
- Enforce the cancellation penalty rules as defined in Terms of Service §2.2. Penalties are calculated over `base_amount` (service price, excluding card processing fees): >48h before service = full refund of `base_amount`; 48h–12h = 90% of `base_amount`; <12h = 70% of `base_amount`. Card processing fees are non-refundable in all scenarios.

**Technical Objectives:**

- Implement a `PaymentProvider` interface that fully decouples business logic from any specific gateway implementation (initially NetCred), enabling future provider substitution (Pagar.me, Asaas, Stripe, Mercado Pago) without rewriting business rules.
- Provide a durable, PostgreSQL-backed job queue for charge scheduling and processing, with `SELECT FOR UPDATE SKIP LOCKED` for concurrency-safe dequeueing, lease-based orphan recovery, and automated janitor cleanup.
- Ensure all charge operations are idempotent via a `referenceCode` (`contracted_service_id` UUID) key at the gateway level and a `idempotency_key` UNIQUE constraint at the database level.
- Instrument all payment lifecycle events with structured Sentry traces and PostgreSQL audit tables for full operational observability and dispute resolution.
- Enable future payment methods (Pix, Boleto) without schema redesign by implementing discriminated union types in all payment interfaces.

**Operational Constraints:**

- The charge cron MUST execute at minimum 4 times per day at configurable intervals.
- Automatic charge attempts (cron-initiated) MUST NOT exceed 3 per payment schedule (configurable via `platform_constants.max_charge_attempts`). After exhausting automatic attempts, the schedule transitions to `FAILED_PERMANENT` and a manual recovery path is exposed to the client. Manual attempts (client-initiated) have a separate counter and are unlimited until T-12h.
- Auto-cancellation of unpaid services MUST trigger when `service_scheduled_at - now() <= 12 hours` and payment remains in `FAILED_PERMANENT` or unresolved failure state.
- The charge amount is NOT the `base_amount` from the proposal alone: it includes installment fees computed from `platform_constants` and recalculated at cron execution time, not cached from checkout.
- All fee rates (credit card brand, installment range, fixed processing fee) MUST be configurable via `platform_constants` without code deployments.

**Architectural Principles:**

1. **Provider Agnosticism**: All business logic operates against a `PaymentProvider` interface. Gateway-specific semantics (GraphQL mutations, token structures, event types) are encapsulated in provider adapters within `src/features/payments/adapters/`.
2. **State Persistence in PostgreSQL**: Payment schedule state, transaction history, webhook events, and audit logs are the authoritative record. No ephemeral state in Edge Function memory is authoritative.
3. **Idempotency at Every Layer**: Every chargeable operation, webhook event, and retry carries a deterministic idempotency key enforced via database UNIQUE constraints.
4. **Fail-Safe by Default**: Pre-execution validations (provider not credentialed, card token invalid, service cancelled) MUST cause the cron to skip safely without side effects.
5. **Observability First**: Every state transition, gateway API call, and error MUST be captured with Sentry context and structured logs containing correlation identifiers.
6. **Separation of Concerns**: Edge Functions are I/O connectors. State ownership, locking, and transition logic reside in PostgreSQL RPCs. The React application layer renders state and dispatches actions.

---

## Assumptions

- **Runtime**: Node.js 24.13 (application layer), Deno runtime (Supabase Edge Functions).
- **Frontend**: React 19, Vite 7, TypeScript 5.9, TanStack Query 5, React Hook Form + Zod 4 for schema validation.
- **Backend**: Supabase PostgreSQL 15+, Row Level Security (RLS) enforced on all payment tables, Supabase Auth (JWT sessions).
- **Scheduling**: `pg_cron` extension enabled on the Supabase project; charge cron fires at minimum 4 times per day (configurable UTC-3 intervals, recommended: 06:00, 12:00, 18:00, 00:00).
- **Queue Mechanism**: PostgreSQL table-based queue with `SELECT FOR UPDATE SKIP LOCKED` for concurrent-safe dequeueing; lease TTL enforced via `locked_until` (TIMESTAMPTZ) column.
- **Locking Semantics**: Row-level pessimistic locking (`FOR UPDATE`) for payment schedule checkout; `SKIP LOCKED` for parallel worker safety; all transitions inside PL/pgSQL RPCs for atomicity.
- **External Payment Gateway**: NetCred GraphQL API — sandbox: `https://api.sandbox.netcredbrasil.com.br/graphql`; production: `https://api.netcredbrasil.com.br/graphql`. Authenticated via JWT (`tokenAuth` mutation, 24h TTL).
- **Payment Provider Abstraction**: `PaymentProvider` interface defined in `src/features/payments/types/`; `NetCredAdapter` in `src/features/payments/adapters/netcred/`.
- **Notification Channels**: Push notifications via Firebase Cloud Messaging (FCM); transactional email via Resend. Both routed through the Orbit Multichannel Message Dispatcher with bypass-priority configuration for payment events.
- **Observability**: Sentry for Edge Function error tracking and performance spans; structured logger (`supabase/functions/_shared/`) with correlation IDs; PostgreSQL audit tables for immutable event history.
- **Webhook Reception**: Supabase Edge Function `netcred-webhook` receives NetCred webhook payloads. Validates `X-NETCRED-Signature = SHA256(secretKey + rawBody)`. `secretKey` stored in Supabase Vault.
- **Retry Mechanism**: Automatic cron-initiated attempts tracked in `automatic_attempt_count`, up to `max_charge_attempts` (default: 3, from `platform_constants`); manual client-initiated attempts tracked in `manual_attempt_count` (unlimited until T-12h, rate-limited by Edge Function). Retry interval: `charge_retry_interval_minutes` (default: 30 minutes). All configurable without code changes.
- **Installment Fees**: Configurable per card brand and installment range in `platform_constants`; Edge Function computes final charged amount; responses are HMAC-SHA256 signed to prevent client-side tampering of computed amounts.
- **Split Model**: The service provider receives `FIXED_AMOUNT = final_amount` (the amount agreed in the accepted proposal); Renovi receives `PERCENTAGE = 100.0` of the remainder (`charge_amount − final_amount`), covering platform commission and card processing fees. Both parties are configured with `isLiable = true`, meaning card processing fees are deducted proportionally from each party's net payout, and refunds are distributed proportionally between all liable accounts.
- **PCI DSS**: No raw card data (PAN, CVV) persisted in Renovi infrastructure. Only gateway-issued tokenized references: `provider_payment_profile_id`, `card_number_masked`, `card_brand`, `provider_card_token`.
- **Cancellation Policy**: Per Terms of Service §2.2 — penalty is applied to `base_amount` only (card processing fees are non-refundable): >48h: `refund_amount = base_amount` (100%); 48h–12h: `refund_amount = base_amount × 0.90` (10% penalty); <12h: `refund_amount = base_amount × 0.70` (30% penalty). Provider-initiated cancellations: `refund_amount = charge_amount` (full amount including card fees). Gateway distributes the refund proportionally between all `isLiable` accounts.
- **At-least-once Delivery**: Webhooks and cron executions operate under at-least-once semantics; idempotency keys prevent duplicate side effects.
- **Secrets Management**: NetCred credentials, webhook `secretKey`, and HMAC signing secret stored exclusively in Supabase Vault. MUST NOT appear in application code, environment variable files committed to source control, or any client-accessible layer.
- **Rescheduling Interaction**: When a service is rescheduled (as defined in `docs/cancelamento-reagendamento-servicos/details.md`), the existing `payment_schedules` record's `charge_scheduled_at` MUST be recalculated if `state ∈ {SCHEDULED, FAILED, IN_ANALYSIS}`: `charge_scheduled_at = MAX(now(), new_service_scheduled_at − interval '2 days')`. If `new_service_scheduled_at − now() < 48 hours`, `charge_scheduled_at = now()` (emergency scheduling). Auto-cancellation T-12h threshold uses the **updated** `service_scheduled_at`. If `state = PAID`, only the service date is updated; no new charge is created.
- **Emergency Scheduling**: If `service_scheduled_at - now() < 48 hours` at acceptance time, `charge_scheduled_at` is set to `now()` so the next cron picks it up immediately.
- **chargeCreate timing**: The NetCred `chargeCreate` mutation is NEVER called at proposal acceptance. It is ONLY called by the cron (or manual retry flow) at T-2. No `rrule` scheduling is used at the gateway; scheduling is owned entirely by Renovi's cron subsystem.
- **ClearSale Behavior Analytics**: ClearSale Device Fingerprint / Behavior Analytics is enabled by default on the NetCred production account. The `orderInput.sessionId` field in `chargeCreate` is **mandatory** in production. The ClearSale Browser/WebView SDK (`fp.js`) MUST be initialized on the card step of the checkout stepper; it collects public device data (IP, device characteristics, network info) and transmits it to ClearSale servers asynchronously. The `sessionId` (a UUID generated by the frontend for each checkout session) binds the SDK collection to the subsequent `chargeCreate` call. Because `chargeCreate` runs at T-2 (48h later, via cron with no user context), the `sessionId` MUST be persisted in `payment_schedules.clearsale_session_id` at acceptance time. The `CLEARSALE_APP_KEY` (provided by ClearSale, identifies the Renovi application) is a non-secret value stored as a Vite env variable (`VITE_CLEARSALE_APP_KEY`). Since Orbit runs as a Capacitor WebView on Android, the Browser/WebView SDK applies to both web/PWA and Android deployments. `billingAddressInput` is also **mandatory** in all production tokenization calls when ClearSale is active.
- **ClearSale Session Persistence**: `payment_schedules.clearsale_session_id` stores the `sessionId` captured at checkout. `payment_schedules.client_ip_address` stores the client IP captured at acceptance time; both fields are passed to `chargeCreate` (`orderInput.sessionId` and `customerIpAddress`) by the cron at T-2.
- **Provider Payout Timing**: Split is defined at `chargeCreate` (`payoutRuleInput`). Bank settlement to provider and Renovi occurs on NetCred's card liquidation calendar after `PAID` — **not** gated by `EXECUTED` or `COMPLETED`. Credit card settlement cycle: **D+30** (confirmed operationally). `EXECUTED`/`COMPLETED` are operational milestones only; real escrow with payout hold requires future NetCred product negotiation.
- **Pre-Charge Client Notification**: Push + Email reminder sent **24 hours before** `charge_scheduled_at` when `state = SCHEDULED`. Checkout stepper MUST disclose when the charge will occur before acceptance is confirmed. Emergency scheduling (<48h): checkout shows "charge within the next few hours"; 24h reminder does not apply.

---

## Operational Phases

### Phase 1: Provider Credentialing Phase

Responsible for collecting KYC data from service providers within the Orbit app, dispatching a structured KYC email to the NetCred credentialing address, and polling the `companies` GraphQL query in daily batches (up to 50 providers per request using GraphQL aliases) to detect credentialing approval. Governs the transition of provider accounts from `PENDING_DOCUMENTS` → `ACTIVE`, and gates all access to paid service opportunities behind `ACTIVE` credentialing status. Until `ACTIVE`, the provider's opportunities list is empty and a blocking credentialing-pending screen is displayed.

### Phase 2: Client Profile Completion Phase

Responsible for collecting any missing client profile attributes required for payment processing (CPF, phone number, billing address) during the service acceptance stepper flow. Executed conditionally: steps are shown only when the corresponding field is absent from `profiles` / `client_profiles_private`. Completed fields are persisted immediately so subsequent acceptance flows skip already-collected steps.

### Phase 3: Card Tokenization Phase

Responsible for collecting card data in a PCI-compliant manner (frontend form → Edge Function → NetCred `paymentProfileCreate`) and persisting only the gateway-issued tokenized references. Supports both the service acceptance flow and standalone card management from the client profile screen. Produces a `payment_tokens` record containing only non-sensitive card metadata.

### Phase 4: Installment Calculation and Acceptance Phase

Responsible for computing the set of installment options (1–12 installments) with brand-specific fees read from `platform_constants`, generating an HMAC-signed response for tamper prevention, presenting these options to the client, and persisting the selected installment count alongside the acceptance record. Also validates the HMAC signature server-side before `accept_proposal` proceeds.

### Phase 5: Charge Scheduling Phase

Responsible for creating a durable `payment_schedules` record upon service acceptance, computing and persisting `charge_scheduled_at = service_scheduled_at − 48 hours` (or `now()` for emergency scheduling), and linking all charge-time preconditions (payment token ID, installment number, provider credentialing IDs). Establishes the authoritative queue record the cron will consume.

### Phase 6: Charge Execution Phase

Responsible for the cron-driven execution of `chargeCreate` via the payment provider adapter. Selects eligible schedules (state `SCHEDULED` or `FAILED` with remaining attempts, `charge_scheduled_at::date <= CURRENT_DATE`, service active, provider credentialed, lease not held). Acquires a row-level lease (`FOR UPDATE SKIP LOCKED`), computes the final amount with current fees (via RPC), executes the gateway charge, and transitions the schedule to `PAID`, `FAILED`, `FAILED_PERMANENT`, or `IN_ANALYSIS`.

### Phase 7: Retry and Recovery Phase

Responsible for automatic re-queuing of `FAILED` schedules within the `max_charge_attempts` limit, respecting `charge_retry_interval_minutes` between attempts. Classifies errors as retryable (transient network/5xx) or terminal (card declined, invalid CPF). After all attempts are exhausted, transitions to `FAILED_PERMANENT`, notifies both client and provider, and exposes a manual recovery button in the service detail UI for both `FAILED` and `FAILED_PERMANENT` states. Executes auto-cancellation at T-12h for unresolved payments.

### Phase 8: Webhook Processing Phase

Responsible for receiving all NetCred webhook events (via Edge Function `netcred-webhook`), validating the `X-NETCRED-Signature`, deduplicating events via UNIQUE constraint, dispatching to per-event-type handlers, applying state machine transitions, enqueueing notifications, and persisting the full event log. Acts as the primary mechanism for confirming asynchronous transaction outcomes (antifraude completion, settlement, refund confirmation).

### Phase 9: Refund and Cancellation Phase

Responsible for executing partial or full refunds upon service cancellation post-charge, enforcing Terms of Service §2.2 penalty tiers, computing refund amounts, invoking `transactionRefund` via the provider adapter, transitioning payment state through `REFUND_REQUESTED` → `REFUNDED` / `PARTIALLY_REFUNDED` upon webhook confirmation.

### Phase 10: Monitoring and Reconciliation Phase

Responsible for polling-based reconciliation of payments in intermediate states (fallback for missed webhooks), automated lease orphan recovery (janitor), metrics collection for approval/failure rates and gateway latency, and dead-letter queue management for persistently failed webhook events.

### Phase 11: Pre-Charge Notification Phase

Responsible for notifying clients before automatic charge execution. Sends Push + Email **24 hours before** `charge_scheduled_at` for schedules in `SCHEDULED` state. Checkout stepper displays charge timing disclosure at acceptance. Does not notify providers about client card charges.

---

## State Machine

### 0. Contracted Service Status

```
PENDING_PAYMENT
CONFIRMED
EXECUTED
COMPLETED
CANCELLED
```

### 1. Provider Credentialing States

```
PENDING_DOCUMENTS
DOCUMENTS_SUBMITTED
UNDER_NETCRED_REVIEW
ACTIVE
REJECTED
SUSPENDED
```

### 2. Payment Token (Card) States

```
ACTIVE
EXPIRED
REVOKED
TOKENIZATION_FAILED
```

### 3. Payment Schedule States

```
SCHEDULED
PROCESSING
PAID
IN_ANALYSIS
FAILED
FAILED_PERMANENT
CANCELLED
VOIDED
REFUND_REQUESTED
REFUNDED
PARTIALLY_REFUNDED
EXPIRED
```

### 4. Payment Transaction States

```
PENDING
AUTHORIZING
IN_ANALYSIS
PAID
REJECTED
VOIDED
REFUNDED
PARTIALLY_REFUNDED
EXPIRED
DISPUTED
```

### 5. Webhook Event Processing States

```
RECEIVED
VALIDATING
PROCESSING
PROCESSED
DUPLICATE
FAILED
DEAD_LETTER
```

---

### State Definitions

#### Contracted Service Status

- **PENDING_PAYMENT** *(initial)*: Service accepted and commitment established, but charge not yet captured (`payment_schedules.state ≠ PAID`). Client can view; provider does NOT see in calendar. Notificações de trabalho confirmado ao prestador são permitidas neste estado.
- **CONFIRMED**: Charge captured (`payment_schedules.state = PAID`). Service awaiting execution. Provider sees in calendar and may prepare for delivery. Transitioned from `PENDING_PAYMENT` via `PAID` webhook.
- **EXECUTED**: Provider has marked the service as executed. `executed_at` is set. Awaiting client confirmation. Auto-promoted to `COMPLETED` 24 hours after `executed_at` if client does not confirm. Provider MAY mark `EXECUTED` only when `scheduled_date ≤ today` (date comparison only — no time component).
- **COMPLETED** *(terminal — happy path)*: Service concluded. Reached via explicit client confirmation from `EXECUTED`, or automatic cron promotion 24h after `executed_at`. Does not gate provider bank settlement (see Provider Payout Timing assumption).
- **CANCELLED** *(terminal)*: Service cancelled. `cancellation_reason` qualifies the cause: `NON_PAYMENT` (auto-cancel at T-12h), `CLIENT_INITIATED`, `PROVIDER_INITIATED`, `PROVIDER_SUSPENDED` (provider suspended before charge). No separate `SERVICE_CANCELLED_NON_PAYMENT` status exists.

#### Provider Credentialing States

- **PENDING_DOCUMENTS** *(initial)*: Provider completed basic platform registration but has not yet submitted KYC documents. Access to paid service opportunities is blocked. Transitional; not terminal.
- **DOCUMENTS_SUBMITTED**: Provider submitted all KYC documents; formatted email dispatched to `credenciamento@netcred.com.br`. `onboarding_submitted_at` is set. Pending external gateway processing.
- **UNDER_NETCRED_REVIEW**: Daily `companies` query returned a non-empty result for the provider's document but `companyState ≠ ACTIVE`. External review in progress.
- **ACTIVE** *(terminal — happy path)*: Gateway confirmed credentialing (`companyState = ACTIVE`); `netcred_company_id` and `netcred_bank_account_id` populated. Provider may participate in paid services.
- **REJECTED** *(terminal)*: Gateway or internal review rejected credentialing. Manual support intervention required. Provider cannot participate in paid services.
- **SUSPENDED** *(quasi-terminal)*: Post-activation administrative suspension (compliance violation, dispute excess). Reversible by admin action only. Provider loses all new marketplace access (opportunities, proposals, chat initiation). Existing `CONFIRMED`/`EXECUTED` services are honoured; pre-charge services (`PENDING_PAYMENT`) are frozen until T-12h, then auto-cancelled with `cancellation_reason = PROVIDER_SUSPENDED`. Reactivation `SUSPENDED → ACTIVE` does **not** automatically resume charging on frozen services — ops resolves case by case.

#### Payment Schedule States

- **SCHEDULED** *(initial)*: Service accepted, `charge_scheduled_at` set. Cron has not yet attempted this schedule. Safe to cancel without gateway interaction.
- **PROCESSING** *(transitional)*: Cron has acquired a row-level lease (`locked_until` set) and a gateway `chargeCreate` call is in flight. Concurrent workers MUST skip this record via `SKIP LOCKED`.
- **PAID** *(terminal — happy path)*: Gateway returned `transactionState = PAID` or webhook `TRANSACTION_CAPTURE` confirmed. Service proceeds to execution.
- **IN_ANALYSIS** *(transitional)*: Gateway antifraude returned `IN_ANALYSIS` or `MANUAL_ANALYSIS`. Awaiting `TRANSACTION_CAPTURE` or `TRANSACTION_UPDATE` webhook to resolve. Auto-cancellation MUST NOT trigger for records in this state.
- **FAILED** *(transitional)*: A charge attempt failed with a retryable error. `automatic_attempt_count < max_charge_attempts`. Eligible for automatic retry on next cron execution when `next_retry_at <= now()`. Manual client attempts remain available regardless of `automatic_attempt_count`.
- **FAILED_PERMANENT** *(quasi-terminal)*: All `max_charge_attempts` automatic attempts exhausted OR a terminal gateway error occurred (card declined, invalid CPF). Manual client intervention required. Auto-cancellation triggers at T-12h if unresolved. Manual attempts via client UI remain permitted until T-12h.
- **CANCELLED** *(terminal)*: Service was cancelled before charge executed (pre-T-2), or auto-cancellation fired at T-12h for non-payment, or manual cancellation after failed payment.
- **VOIDED** *(terminal)*: Charge was created at gateway but voided via `chargeVoid`/`transactionVoid` before capture (reconciliation edge case during retry).
- **REFUND_REQUESTED** *(transitional)*: `transactionRefund` submitted to gateway; awaiting `TRANSACTION_REFUND` webhook confirmation.
- **REFUNDED** *(terminal)*: Full refund confirmed by gateway webhook. 100% of paid amount returned to client.
- **PARTIALLY_REFUNDED** *(terminal)*: Partial refund confirmed (10% or 30% penalty retention per ToS §2.2; applied to `base_amount` only — card processing fees are non-refundable).
- **EXPIRED** *(terminal)*: Gateway transaction expired without capture (rare in this cron-driven model).

#### Webhook Event Processing States

- **RECEIVED**: Raw payload ingested into `payment_webhook_events`; signature validation pending.
- **VALIDATING**: `X-NETCRED-Signature` HMAC comparison in progress.
- **PROCESSING**: Event matched to local entity; state machine update in progress within a database transaction.
- **PROCESSED**: State machine updated successfully; HTTP 200 returned.
- **DUPLICATE**: Composite UNIQUE constraint violation detected; no-op; HTTP 200 returned.
- **FAILED**: Processing error occurred; `retry_count` incremented; eligible for retry with exponential backoff.
- **DEAD_LETTER**: `retry_count >= 3`; requires manual investigation; CRITICAL Sentry alert emitted.

---

## Operational Architecture Constraints

### Execution Model

The charge execution subsystem SHALL operate as a **cron-driven, table-queue-based worker** executing within Supabase Edge Functions invoked by `pg_cron`. The cron SHALL invoke the Edge Function `schedule-netcred-charges` at minimum 4 times per day at configurable UTC-3 intervals (recommended: 06:00, 12:00, 18:00, 00:00).

Each invocation MUST:

1. Select from `payment_schedules` where `charge_scheduled_at::date <= CURRENT_DATE` AND `state IN ('SCHEDULED', 'FAILED')` AND `automatic_attempt_count < max_charge_attempts` AND `locked_until IS NULL OR locked_until < now()` AND `next_retry_at IS NULL OR next_retry_at <= now()` AND associated service is not cancelled AND `payment_token_id IS NOT NULL` AND provider `onboarding_status = 'ACTIVE'`.
2. Acquire a row-level lease via `SELECT ... FOR UPDATE SKIP LOCKED` within an explicit transaction; set `state = 'PROCESSING'`, `locked_until = now() + '<payment_lease_duration_minutes> minutes'::interval`, `automatic_attempt_count = automatic_attempt_count + 1` atomically.
3. Release the acquiring transaction before invoking the gateway (prevents long-held locks during HTTP I/O).
4. Execute `chargeCreate` against the `NetCredAdapter`.
5. Commit the final state (`PAID`, `FAILED`, `FAILED_PERMANENT`, `IN_ANALYSIS`) atomically within a new transaction, including audit log insertion.

### Persistence Strategy

- **Source of truth for payment state**: PostgreSQL `payment_schedules` and `payment_attempts` tables.
- **Provider-specific IDs**: Stored in dedicated columns prefixed with the `provider_slug` (e.g., `netcred_charge_id`, `netcred_transaction_id`) to enable future multi-provider routing.
- **Audit log**: Every state transition MUST produce an immutable INSERT into `payment_audit_log` within the same transaction as the state change. This table is INSERT-only; application roles MUST NOT have UPDATE or DELETE permissions.
- **Webhook events**: ALL received webhook payloads MUST be persisted to `payment_webhook_events` before any validation or processing occurs.
- **Fee configuration**: All rate values stored in `payment_providers` / `platform_constants`; NEVER hardcoded in Edge Function or application code.
- **Secrets**: NetCred JWT credentials, `secretKey`, and HMAC signing secret stored exclusively in Supabase Vault. Accessed only by server-side Edge Functions via service role.

### Concurrency Control

- The cron worker MUST NOT process the same `payment_schedule` in parallel. `SELECT ... FOR UPDATE SKIP LOCKED` is the mandatory dequeueing primitive.
- Lease duration MUST exceed the maximum expected gateway response time plus processing overhead (default: 10 minutes).
- A janitor RPC (`recover_orphaned_payment_schedules()`) MUST be invoked every 30 minutes by `pg_cron` to detect records stuck in `PROCESSING` with `locked_until < now()` and transition them: if `automatic_attempt_count = 0` → `SCHEDULED`; if `automatic_attempt_count > 0` → `FAILED`.
- Manual payment flow and cron MUST NOT execute concurrently for the same schedule. The `FOR UPDATE` lock ensures the second accessor detects the held lease and aborts.

### Idempotency

- `chargeCreate` MUST include `referenceCode = contracted_service_id` (UUID v4, `contracted_services.id`). The NetCred API enforces uniqueness; a duplicate `chargeCreate` with the same `referenceCode` returns a detectable error. The adapter MUST handle this by calling `getTransaction(referenceCode)` to reconcile the existing charge.
- `paymentProfileCreate` (tokenization) is NOT idempotent at the gateway level. The adapter MUST check for an existing valid `payment_tokens` record (by `client_id` + `provider_id` + `state = 'ACTIVE'`) before re-tokenizing to avoid unnecessary gateway calls.
- Webhook events MUST be deduplicated by a UNIQUE constraint on `(provider_slug, event_type, provider_event_id)` in `payment_webhook_events`. Duplicate delivery returns HTTP 200 without reprocessing.
- Installment calculation responses MUST be HMAC-SHA256 signed using `INSTALLMENT_SIGNING_SECRET` stored in Vault. The signed payload MUST include an `expires_at` timestamp (10 minutes from computation). The `accept_proposal` server handler MUST verify the signature and reject expired payloads with `INSTALLMENT_SIGNATURE_EXPIRED`; the client app MUST re-open the installment selection step with a fresh calculation (card token and other stepper data are preserved).
- All `payment_schedules` records MUST carry a `idempotency_key` column with a UNIQUE constraint, set to `contracted_service_id` (`contracted_services.id`). This prevents duplicate schedule creation on `accept_proposal` retries.

### Retry Semantics

- **Automatic attempts** (cron-initiated): tracked in `automatic_attempt_count`, capped at `max_charge_attempts` (default: 3, from `platform_constants`). On exhaustion, schedule transitions to `FAILED_PERMANENT`.
- **Manual attempts** (client-initiated): tracked in `manual_attempt_count`, unlimited until T-12h threshold, rate-limited by the `manual-charge-payment` Edge Function. Manual attempts do NOT reactivate automatic retries.
- `payment_attempts.initiator` MUST be set to `'cron'` for automatic attempts and `'client'` for manual attempts.
- Retry interval (automatic only): `charge_retry_interval_minutes` (default: 30 min). After each automatic failure, `next_retry_at = failed_at + interval`.
- **Error classification**:
  - *Retryable*: network timeouts, HTTP 5xx, GraphQL `INTERNAL_SERVER_ERROR`, gateway unavailability.
  - *Terminal*: `transactionState = REJECTED`, `CPF_INVALID`, `BILLING_ADDRESS_MISSING`, `referenceCode` conflict resolved to a different charge (data integrity issue), `CARD_NOT_FOUND`.
- Terminal errors MUST transition the schedule to `FAILED_PERMANENT` on the first occurrence, bypassing remaining retry budget.
- After `automatic_attempt_count >= max_charge_attempts` on retryable errors, the schedule MUST transition to `FAILED_PERMANENT`.

### Scheduling Semantics

- `charge_scheduled_at` is computed at acceptance time as `service_scheduled_at - interval '2 days'` and persisted in UTC.
- The cron selects schedules where `charge_scheduled_at::date <= CURRENT_DATE` (not strictly `= CURRENT_DATE`) to catch any schedules missed during system downtime.
- If `service_scheduled_at - now() < 48 hours` at acceptance, `charge_scheduled_at = now()`, ensuring the next cron run picks it up immediately.
- If rescheduling changes `service_scheduled_at` and `payment_schedules.state ∈ {SCHEDULED, FAILED, IN_ANALYSIS}`: `charge_scheduled_at = MAX(now(), new_service_scheduled_at − interval '2 days')`. Auto-cancellation T-12h uses the **updated** `service_scheduled_at`. If `state = PAID`, only `service_scheduled_at` is updated for audit; no new charge is created.

### Provider Abstraction Semantics

The `PaymentProvider` interface SHALL expose the following contract:

```typescript
interface PaymentProvider {
  tokenizeCard(input: TokenizeCardInput): Promise<TokenizeCardResult>;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  voidCharge(input: VoidChargeInput): Promise<VoidChargeResult>;
  refundTransaction(input: RefundTransactionInput): Promise<RefundTransactionResult>;
  getTransaction(input: GetTransactionInput): Promise<GetTransactionResult | null>;
  processWebhookEvent(input: ProcessWebhookInput): Promise<ProcessWebhookResult>;
  getProviderCredentials(document: string): Promise<ProviderCredentials | null>;
  refreshAuthToken(): Promise<void>;
}
```

All Edge Function charge execution paths MUST invoke operations through this interface, never issuing gateway-specific GraphQL calls from business logic. The `CreateChargeInput` type MUST include a `paymentMethod: 'CREDIT_CARD' | 'PIX' | 'BOLETO'` discriminated union to accommodate future payment methods without interface changes.

### Fault Tolerance

- **Gateway timeout during `chargeCreate`**: Set schedule to `FAILED` (retryable). On next retry, call `getTransaction(referenceCode)` first; if gateway confirms `PAID`, reconcile as success without issuing a new charge.
- **Gateway downtime** (all attempts fail with network/5xx): After `max_charge_attempts`, transition to `FAILED_PERMANENT`. Manual client intervention is the recovery path.
- **Duplicate cron invocation**: Protected by `SKIP LOCKED` + `PROCESSING` state + `locked_until` lease combination.
- **Webhook delivery failure**: Gateway retries; UNIQUE constraint on `payment_webhook_events` prevents double-processing.
- **Missed webhook**: Reconciliation cron polls `getTransaction(referenceCode)` for stale `IN_ANALYSIS` or `PROCESSING` records older than 30 minutes.
- **Orphaned PROCESSING record**: Janitor RPC detects expired `locked_until` and recovers the record.
- **`referenceCode` returned by gateway but state unknown** (timeout race): Reconciliation query resolves the state; no blind re-charge.

### Stateless Constraints for Edge Functions

- Edge Functions MUST be stateless. No persistent in-memory caches between invocations.
- The NetCred JWT MUST be cached in a `payment_provider_tokens` table row, not in Edge Function memory. The adapter MUST perform a `SELECT FOR UPDATE` on this row to serialize concurrent token refresh operations.
- All configuration (fees, retry limits, timeouts, batch sizes) MUST be read from `platform_constants` at invocation time.

### Observability and Tracing

- Every charge attempt MUST emit a Sentry span with tags: `service_id`, `schedule_id`, `attempt_number`, `provider_slug`, `charge_amount`, `gateway_latency_ms`.
- Every gateway API call MUST emit a Sentry breadcrumb with: mutation name, HTTP status code, response latency, `transactionState` if applicable.
- All state transitions MUST emit a structured log entry via the `logger` utility with: `event_type`, `service_id`, `schedule_id`, `from_state`, `to_state`, `provider_slug`, `error_code` (if applicable), `actor`.
- Webhook events MUST be logged with: `event_type`, `provider_event_id`, `processing_duration_ms`, `outcome`.
- Sentry MUST be initialized in all payment Edge Functions using the shared Sentry DSN from environment secrets.
- All Sentry events MUST carry `service_id` as a tag for cross-system correlation.

---

# Requirements

## Requirement 1: Payment Provider Abstraction Interface

*User Story*: As a Principal Engineer, I want the payment system to operate against a provider-agnostic interface so that the underlying payment gateway (NetCred, Pagar.me, Asaas, Stripe) can be replaced or extended without modifying business logic.

### Acceptance Criteria

**GIVEN** any charge execution, tokenization, or refund operation is triggered  
**WHEN** the operation is dispatched  
**THEN** the system MUST route the operation through the `PaymentProvider` interface; no business logic code SHALL reference `NetCred`, `GraphQL`, or any gateway-specific type directly.

**GIVEN** the `NetCredAdapter` is invoked  
**WHEN** it translates a `CreateChargeInput` to a NetCred `chargeCreate` mutation  
**THEN** all NetCred-specific field mappings (GraphQL variables, `companyId`, `payoutRuleInput`, `orderInput`) MUST be encapsulated entirely within the adapter; the calling cron code MUST NOT be aware of these fields.

**GIVEN** a gateway authentication error (`tokenAuth` failure or HTTP 401) is encountered during any adapter method  
**WHEN** the error is classified as `ProviderAuthError`  
**THEN** the adapter MUST attempt exactly one token refresh via `refreshAuthToken()` and retry the original operation once; if the retry also fails, the error MUST be propagated as-is to the caller without further retries.

**GIVEN** a future provider (e.g., Pagar.me) is registered  
**WHEN** a new `PagarMeAdapter` is created and registered under `provider_slug = 'pagarme'`  
**THEN** the charge execution cron MUST route requests to the correct adapter based on `payment_schedules.provider_slug`, requiring zero changes to scheduling or state management logic.

**GIVEN** the `CreateChargeInput` type is defined  
**WHEN** the type system is designed  
**THEN** the `paymentMethod` field MUST use a discriminated union: `'CREDIT_CARD' | 'PIX' | 'BOLETO'`; each method type MUST carry method-specific subfields (e.g., `CreditCardCharge` with `installmentNumber`, `PixCharge` with `expiresAt`), ensuring new payment methods require only a new adapter implementation.

**GIVEN** `getTransaction` is called for reconciliation  
**WHEN** the gateway has no record for the given `referenceCode`  
**THEN** the adapter MUST return `null` (not throw); the cron MUST treat `null` as "no prior charge exists" and proceed with a new `createCharge` if within retry budget.

**GIVEN** a `transactionRefund` is issued for a non-existent or already-fully-refunded transaction  
**WHEN** the gateway returns a specific error code  
**THEN** the adapter MUST map the error to an internal `RefundError` type with `code: 'ALREADY_REFUNDED' | 'TRANSACTION_NOT_FOUND'`; the caller MUST handle both cases idempotently (no re-throw for `ALREADY_REFUNDED`).

---

## Requirement 2: NetCred Authentication Token Lifecycle

*User Story*: As an Edge Function executing gateway calls, I want the NetCred JWT to be automatically managed and refreshed so that no API call fails due to an expired authentication token.

### Acceptance Criteria

**GIVEN** the NetCred JWT has a 24-hour validity period  
**WHEN** any NetCred API operation is initiated  
**THEN** the adapter MUST read the cached token from `payment_provider_tokens` WHERE `provider_slug = 'netcred'`; if `expires_at - now() < 60 minutes`, it MUST refresh the token via `tokenAuth` before proceeding.

**GIVEN** the `payment_provider_tokens` row is being refreshed  
**WHEN** multiple concurrent Edge Function invocations attempt the refresh simultaneously  
**THEN** the adapter MUST use `SELECT ... FOR UPDATE` on the `payment_provider_tokens` row to serialize the refresh; only one invocation MUST call `tokenAuth`; all others MUST wait and reuse the token obtained by the winner.

**GIVEN** `tokenAuth` returns a valid `token`  
**WHEN** the result is persisted  
**THEN** `payment_provider_tokens` MUST be upserted with `token`, `expires_at = now() + interval '24 hours'`, and `refreshed_at = now()`; the token MUST be stored encrypted at rest (Supabase column encryption or Vault reference).

**GIVEN** `tokenAuth` fails (invalid credentials, network error)  
**WHEN** the error is caught  
**THEN** the adapter MUST emit a `CRITICAL` Sentry alert with `{ provider_slug: 'netcred', error_type: 'AUTH_FAILURE' }`; the charge execution MUST be aborted; the schedule MUST be set to `FAILED` (retryable) without incrementing `automatic_attempt_count`.

**GIVEN** the system is in production mode  
**WHEN** `tokenAuth` responds with `user.sandbox = true`  
**THEN** the adapter MUST raise a `CRITICAL` error, emit a Sentry alert, and abort the operation; this assertion prevents sandbox credentials from executing real charges.

---

## Requirement 3: Provider Credentialing — KYC Collection

*User Story*: As a service provider, I want to complete my KYC registration entirely within the Renovi app so that I can be credentialed with the payment gateway and receive compensation for services I deliver.

### Acceptance Criteria

**GIVEN** a provider completes basic platform registration  
**WHEN** they first access the provider dashboard  
**THEN** the app MUST present a blocking KYC onboarding screen that CANNOT be dismissed until all required fields for the provider's entity type (CPF or CNPJ) are submitted.

**GIVEN** the provider is a natural person (CPF)  
**WHEN** they submit KYC  
**THEN** the system MUST collect and validate: full name, CPF (validated check digits, digits only), mobile phone, email (must match Renovi account email), identity document upload (CPF/CNH), proof of address upload, bank institution code, branch number without check digit, checking account with check digit, optional PIX key.

**GIVEN** the provider is a legal entity (CNPJ)  
**WHEN** they submit KYC  
**THEN** the system MUST additionally collect: razão social, nome fantasia, CNPJ (validated), corporate charter/constitution document upload, legal representative identity document upload, proof of company address upload, legal representative full name, legal representative CPF, legal representative phone; all other bank data fields apply equally.

**GIVEN** KYC form submission is complete and all validations pass  
**WHEN** the provider taps "Submit"  
**THEN** the system MUST atomically: (1) persist all data in `provider_kyc_submissions`, (2) set `provider_accounts.onboarding_status = 'DOCUMENTS_SUBMITTED'`, (3) record `onboarding_submitted_at = now()`, (4) enqueue a KYC email dispatch job containing all fields and document attachment URLs to `credenciamento@netcred.com.br`.

**GIVEN** the KYC email dispatch fails (Resend API error, network failure)  
**WHEN** the failure is caught  
**THEN** the system MUST NOT leave `onboarding_status = 'DOCUMENTS_SUBMITTED'` without a confirmed dispatch; it MUST queue the email in a retry job with exponential backoff; the provider's app MUST show a "submitting..." pending state until email delivery is confirmed.

**GIVEN** a provider's `onboarding_status ≠ 'ACTIVE'`  
**WHEN** the RPC `match_provider_jobs` is called for that provider  
**THEN** it MUST return an empty result set; the enforcement MUST occur in the RPC (Postgres, `SECURITY DEFINER`), not only in client-side rendering.

**GIVEN** a provider's `onboarding_status ≠ 'ACTIVE'`  
**WHEN** they attempt to initiate a chat conversation with a client  
**THEN** the chat initiation RPC MUST be denied; no chat thread MUST be created; the provider MUST see a blocking screen directing them to complete credentialing.

**GIVEN** a provider's `onboarding_status = 'SUSPENDED'`  
**WHEN** they access the app  
**THEN** they MUST see a suspension message with support contact information; ALL opportunity-access and chat-initiation RPCs MUST deny access identically to non-credentialed providers; existing `CONFIRMED`/`EXECUTED` service threads remain accessible.

---

## Requirement 4: Provider Credentialing — NetCred Onboarding Detection Cron

*User Story*: As the platform operations team, I want the system to automatically detect when NetCred has approved a provider's credentialing so that providers are activated without manual back-office intervention.

### Acceptance Criteria

**GIVEN** the `detect-netcred-onboarding` cron fires once per day  
**WHEN** it executes  
**THEN** it MUST select providers from `provider_accounts` WHERE `onboarding_status IN ('DOCUMENTS_SUBMITTED', 'UNDER_NETCRED_REVIEW')` AND process them in batches of exactly `provider_batch_size_onboarding` (default: 50, from `platform_constants`).

**GIVEN** a batch of up to 50 provider documents is assembled  
**WHEN** the GraphQL request is issued  
**THEN** it MUST be a single HTTP POST to the NetCred API containing all provider documents as aliased `companies(document: "…")` queries within one request body; the system MUST NOT issue one HTTP request per provider document.

**GIVEN** the batch query response is received  
**WHEN** a `companies` alias contains a node where `companyState = 'ACTIVE'` AND `bankAccounts.edges` is non-empty  
**THEN** the cron MUST atomically: (1) persist `netcred_company_id = node.id`, `netcred_bank_account_id = bankAccounts.edges[0].node.id`, (2) set `onboarding_status = 'ACTIVE'`, `onboarding_activated_at = now()`, (3) emit a structured info log, (4) enqueue a Push notification to the provider confirming activation.

**GIVEN** a `companies` alias returns an empty `edges` array  
**WHEN** the cron processes the result  
**THEN** `onboarding_status` MUST remain unchanged; no error is raised; the record will be re-evaluated in the next daily run.

**GIVEN** a provider document returns `companyState ≠ 'ACTIVE'` but `edges` is non-empty  
**WHEN** the cron processes the result  
**THEN** `onboarding_status` MUST be set to `'UNDER_NETCRED_REVIEW'`; `netcred_company_id` and `netcred_bank_account_id` MUST NOT be persisted.

**GIVEN** a provider document returns multiple `edges` (duplicate records at NetCred)  
**WHEN** the cron processes the result  
**THEN** the system MUST emit a `WARNING` Sentry event and skip automatic activation for that provider; manual review MUST be required before activation.

**GIVEN** a credentialed provider node lacks `bankAccounts` entries  
**WHEN** the cron processes the result  
**THEN** even if `companyState = 'ACTIVE'`, the provider MUST NOT be activated; `onboarding_status` MUST be set to `'UNDER_NETCRED_REVIEW'`; a `WARNING` log MUST be emitted.

**GIVEN** more than 50 providers are pending detection  
**WHEN** the cron executes  
**THEN** it MUST process them in sequential batches of 50 with a configurable inter-batch delay (default: 2 seconds) to respect API rate limits; it MUST NOT attempt all providers in a single request.

---

## Requirement 5: Client Profile Completion at Checkout (Stepper)

*User Story*: As a client accepting a service proposal, I want the system to collect any missing profile data (CPF, phone, billing address) as part of the checkout stepper so that gateway compliance requirements are met without a separate profile screen detour.

### Acceptance Criteria

**GIVEN** a client taps "Next" after selecting a service date in the accept-proposal dialog  
**WHEN** the stepper evaluates client profile completeness  
**THEN** it MUST check for presence of: (1) `CPF` in `client_profiles_private`, (2) `phone` in `profiles`, (3) a billing address in the payment profile; each missing field generates one additional stepper step, in that order, before the card selection step.

**GIVEN** a client is shown the CPF collection step  
**WHEN** they submit a CPF value  
**THEN** the system MUST validate CPF format AND check digits client-side (before submission) and server-side (in the Edge Function); an invalid CPF MUST produce a field-level error with a descriptive message; the stepper MUST NOT advance on validation failure.

**GIVEN** a client successfully submits CPF in the stepper  
**WHEN** the value is persisted  
**THEN** `client_profiles_private.cpf` MUST be updated in the same Edge Function call; the CPF collection step MUST NOT appear in any subsequent acceptance flow for the same client.

**GIVEN** a client has `CPF` but lacks `phone` in their profile  
**WHEN** the phone collection step is displayed  
**THEN** the UI MUST explain that the phone is required by the payment partner for transaction processing and fraud prevention; the explanation MUST reference the payment partner without naming NetCred in the user-facing copy.

**GIVEN** a client has no saved `payment_tokens` in `ACTIVE` state  
**WHEN** the card selection step is rendered  
**THEN** the system MUST display a full card input form collecting: card number (16 digits, formatted), expiry month, expiry year, CVV, cardholder full name, and billing address fields (logradouro, número, complemento, bairro, cidade, estado, CEP).

**GIVEN** a client has one or more `payment_tokens` with `state = 'ACTIVE'`  
**WHEN** the card selection step is rendered  
**THEN** the system MUST display each saved card as a selectable option showing: masked card number (`•••• XXXX`), brand icon, expiry month/year; PLUS an "Add new card" option that renders the full card input form.

**GIVEN** the client selects a saved card  
**WHEN** proceeding to the installment step  
**THEN** the selected token's `card_brand` MUST be passed to the installment calculation Edge Function to apply the correct fee schedule (Visa/Master vs Elo/Other).

**GIVEN** the card step is rendered in the checkout stepper (whether showing a new card form or a saved card selection)  
**WHEN** the step component mounts  
**THEN** the frontend MUST: (1) generate a UUID v4 as the ClearSale `sessionId` for this checkout session, (2) inject and initialize the ClearSale Browser/WebView SDK script (`//device.clearsale.com.br/p/fp.js`) with `csdp('app', VITE_CLEARSALE_APP_KEY)` and `csdp('sessionid', generatedSessionId)`; the `sessionId` MUST be stored in component state and carried forward through the stepper until included in the `accept_proposal` payload.

**GIVEN** the ClearSale SDK script is loaded on the card step  
**WHEN** the script executes  
**THEN** it MUST be loaded asynchronously (using the standard ClearSale async loader pattern) so it does not block card form rendering; the SDK collects public device information and transmits it to ClearSale servers transparently; no explicit send call is required for the Browser/WebView SDK.

**GIVEN** the client is on the Capacitor Android app  
**WHEN** the card step renders inside the Capacitor WebView  
**THEN** the Browser/WebView SDK (`fp.js`) MUST be used — NOT the React Native SDK; the Capacitor WebView runs the standard web JavaScript environment and the Browser SDK applies.

---

## Requirement 6: PCI-Compliant Card Tokenization

*User Story*: As a security engineer, I want raw card data to never be stored in Renovi infrastructure so that the platform does not incur PCI DSS cardholder data environment scope obligations.

### Acceptance Criteria

**GIVEN** a client submits card data in the checkout form  
**WHEN** the form action triggers  
**THEN** the frontend MUST invoke the Edge Function `tokenize-payment-card` over HTTPS with the complete card input (PAN, CVV, expiry, cardholder name, CPF, phone, billing address); raw card data MUST NOT be sent to any other endpoint or persist in any browser storage, React state, or React Query cache beyond the in-flight request.

**GIVEN** the Edge Function `tokenize-payment-card` receives the card payload  
**WHEN** it calls `paymentProfileCreate` via the `NetCredAdapter`  
**THEN** `customerInput.persist` MUST be `false`; `customerInput.companyId` MUST be set to `netcred_company_id` of the service provider; `billingAddressInput` MUST be included in ALL calls (production and sandbox with ClearSale enabled) — it is not optional; omitting it when ClearSale is active causes `PaymentProfile requires BillingAddress` error from the gateway.

**GIVEN** `paymentProfileCreate` returns a successful response  
**WHEN** `paymentProfile.isActive = true`  
**THEN** the Edge Function MUST insert a `payment_tokens` record containing ONLY: `provider_payment_profile_id` (= `paymentProfile.id`), `card_number_masked`, `card_brand`, `provider_card_token` (= `paymentProfile.token`), `expiry_month`, `expiry_year`, `cardholder_name`, `billing_address` (JSONB); PAN, CVV, and any raw credential MUST NOT exist in this record.

**GIVEN** `paymentProfileCreate` returns `errors[]` or `isActive = false`  
**WHEN** the tokenization fails  
**THEN** the Edge Function MUST return an error response to the client exposing `errors[].message`; the `accept_proposal` flow MUST NOT proceed; no partial `payment_tokens` record MUST be created.

**GIVEN** a client adds a card from the Profile screen (not acceptance flow)  
**WHEN** tokenization is executed  
**THEN** the SAME `tokenize-payment-card` Edge Function MUST be used; the resulting `payment_tokens` record MUST be associated with `client_id` but without a `service_id` linkage; it MUST be available for selection in future acceptance flows.

**GIVEN** a `PAYMENT_PROFILE_TOKENIZE` webhook arrives with `isActive = false`  
**WHEN** the handler processes it  
**THEN** the corresponding `payment_tokens` record MUST be updated to `state = 'TOKENIZATION_FAILED'`; if this token is linked to a `SCHEDULED` payment schedule, the client MUST be notified to update their payment method.

**GIVEN** a `PAYMENT_PROFILE_EXPIRING` webhook arrives  
**WHEN** the handler processes it  
**THEN** for each `payment_tokens` record matched by `provider_payment_profile_id`, all linked `payment_schedules` in `SCHEDULED` state MUST have their clients notified to update their payment method before `charge_scheduled_at`.

---

## Requirement 7: Installment Calculation and HMAC-Signed Fee Response

*User Story*: As a client selecting installment options at checkout, I want to see accurate, fee-inclusive total amounts for each installment option with the server guaranteeing these amounts cannot be tampered with between calculation and charge execution.

### Acceptance Criteria

**GIVEN** the client reaches the installment selection step in the acceptance stepper  
**WHEN** the step is rendered  
**THEN** the frontend MUST invoke the Edge Function `calculate-installment-options` passing `proposal_id`, `service_id`, and `card_brand`; installment fees MUST NOT be computed client-side.

**GIVEN** `calculate-installment-options` is invoked  
**WHEN** it reads fee configuration  
**THEN** it MUST read all rate values exclusively from `platform_constants`; specifically: `cc_visa_master_1x_rate`, `cc_visa_master_2_6x_rate`, `cc_visa_master_7_12x_rate`, `cc_elo_other_1x_rate`, `cc_elo_other_2_6x_rate`, `cc_elo_other_7_12x_rate`, `cc_fixed_processing_fee_brl`.

**GIVEN** fee rates are loaded and `base_amount` is known  
**WHEN** installment options 1 through 12 are computed  
**THEN** for each installment `n`, the system MUST compute:
- `applicable_rate_pct`: determined by `card_brand` and range (`1x`, `2–6x`, `7–12x`) from `platform_constants`
- `total_with_fees = (base_amount × (1 + applicable_rate_pct / 100)) + cc_fixed_processing_fee_brl`
- `installment_amount = total_with_fees / n`
- `installment_amount` MUST be rounded to 2 decimal places using banker's rounding (round half to even)

**GIVEN** the installment options array is computed  
**WHEN** the Edge Function prepares its response  
**THEN** it MUST generate an HMAC-SHA256 signature over the serialized payload `{ proposal_id, service_id, base_amount, card_brand, installment_options, computed_at, expires_at }` using `INSTALLMENT_SIGNING_SECRET` from Vault; `expires_at = computed_at + 10 minutes`; the signature MUST be included in the response as `installment_selection_hmac`.

**GIVEN** the client selects an installment option and submits acceptance  
**WHEN** `accept_proposal` receives the payload  
**THEN** the server MUST recompute the HMAC over the submitted payload fields and compare with `installment_selection_hmac` using a constant-time comparison; a signature mismatch MUST return HTTP 400 with `error_code: 'INVALID_INSTALLMENT_SIGNATURE'`; an expired payload MUST return HTTP 400 with `error_code: 'INSTALLMENT_SIGNATURE_EXPIRED'`; in both cases the acceptance MUST NOT proceed. The client app MUST handle `INSTALLMENT_SIGNATURE_EXPIRED` by re-opening the installment selection step with a fresh `calculate-installment-options` call; the card token, billing address, and all other stepper data MUST be preserved — only the installment selection and HMAC are reset.

**GIVEN** the cron executes the actual charge at T-2  
**WHEN** the charge amount is computed  
**THEN** the cron MUST call the Postgres RPC `calculate_charge_amount(payment_token_id, base_amount, installment_number)` using the persisted `card_brand` from `payment_tokens`; this RPC MUST use the same fee formula as the Edge Function; the HMAC payload is NOT used for this computation — only the current `platform_constants` values.

**GIVEN** `platform_constants` fee rates are updated between checkout and charge execution  
**WHEN** the cron executes `calculate_charge_amount`  
**THEN** the charge amount MUST reflect the current rates at cron execution time, not the rates displayed during checkout; this is a known and intentional behavior for operational flexibility.

---

## Requirement 8: Service Acceptance Evolution (`accept_proposal`)

*User Story*: As the service acceptance subsystem, I want the `accept_proposal` operation to persist the client's payment method selection and installment choice so that the downstream charge cron has all required preconditions without additional lookup queries.

### Acceptance Criteria

**GIVEN** the client completes the checkout stepper  
**WHEN** `accept_proposal` is submitted  
**THEN** the request body MUST include: `proposal_id`, `scheduled_date`, `payment_method` (`'CREDIT_CARD'`), `payment_token_id` (Renovi UUID from `payment_tokens`), `installment_number` (integer 1–12), `installment_selection_hmac` (the signed payload from the calculation Edge Function), `clearsale_session_id` (the UUID generated at the card step), and `client_ip_address` (collected by the Edge Function from the request's `X-Forwarded-For` / `cf-connecting-ip` header, or passed explicitly by the client); all fields MUST be required for the `CREDIT_CARD` payment method.

**GIVEN** `accept_proposal` validates the HMAC signature (per Requirement 7)  
**WHEN** validation passes and all preconditions are satisfied  
**THEN** the system MUST execute a single PostgreSQL transaction that: (1) creates `contracted_services` record with `status = 'PENDING_PAYMENT'`, (2) creates `payment_schedules` record with `state = 'SCHEDULED'`, `charge_scheduled_at = scheduled_date - interval '2 days'`, `payment_token_id`, `installment_number`, `base_amount`, `idempotency_key = contracted_service_id` (`contracted_services.id`), (3) inserts a `payment_audit_log` entry for `event_type = 'CHARGE_SCHEDULED'`.

**GIVEN** `accept_proposal` receives a `proposal_id`  
**WHEN** server-side validation runs  
**THEN** it MUST load `provider_proposals` and revalidate `pricing_signature` over `proposed_amount`, `tax_amount`, and `final_amount`; invalid or expired signature MUST return HTTP 400 with `error_code: 'PROPOSAL_PRICING_INVALID'`; `base_amount` MUST be set to `proposed_amount` only when signature is valid; both `pricing_signature` and `installment_selection_hmac` MUST pass before acceptance proceeds.

**GIVEN** `scheduled_date - now() < 48 hours` (emergency short-notice service)  
**WHEN** `charge_scheduled_at` is computed  
**THEN** `charge_scheduled_at` MUST be set to `now()` so the next cron invocation picks it up immediately; the `payment_audit_log` entry MUST include `metadata.emergency_scheduling = true`.

**GIVEN** `payment_token_id` references a `payment_tokens` record with `state ≠ 'ACTIVE'`  
**WHEN** `accept_proposal` validates the token  
**THEN** the system MUST return HTTP 422 with `error_code: 'PAYMENT_TOKEN_INACTIVE'`; the acceptance MUST NOT proceed.

**GIVEN** the service provider's `onboarding_status ≠ 'ACTIVE'`  
**WHEN** `accept_proposal` validates preconditions  
**THEN** the system MUST return HTTP 409 with `error_code: 'PROVIDER_NOT_CREDENTIALED'`; the acceptance MUST NOT proceed.

**GIVEN** `accept_proposal` is retried (duplicate submission)  
**WHEN** the `idempotency_key = contracted_service_id` UNIQUE constraint is checked  
**THEN** the database MUST reject the duplicate insert; the API MUST detect the conflict and return the existing `contracted_services.id` with HTTP 200 (idempotent success).

**GIVEN** a client wants to update their payment method for a service in `PENDING_PAYMENT` state  
**WHEN** `payment_schedules.state ∈ {SCHEDULED, FAILED}`  
**THEN** the `update-payment-method` Edge Function MUST allow updating `payment_schedules.payment_token_id` without re-executing `accept_proposal`; if the new card brand differs from the original, a new HMAC-signed installment calculation MUST be obtained and confirmed by the client; `base_amount`, `final_amount`, and `charge_scheduled_at` MUST NOT change; `payment_audit_log` MUST record `event_type = 'PAYMENT_METHOD_UPDATED'`.

**GIVEN** future payment method `PIX` is supported  
**WHEN** `payment_method = 'PIX'`  
**THEN** `payment_token_id` MUST NOT be required; `installment_number` MUST default to 1; `installment_selection_hmac` MUST NOT be required; a `pix_config` sub-object with method-specific fields MAY be present.

---

## Requirement 9: Charge Scheduling Persistence

*User Story*: As the charge execution engine, I want every schedulable service to have a durable `payment_schedules` record containing all charge-time preconditions so that the cron can execute charges without additional resolution queries.

### Acceptance Criteria

**GIVEN** `accept_proposal` succeeds  
**WHEN** the `payment_schedules` record is created  
**THEN** it MUST contain at minimum: `id` (UUID), `contracted_service_id` (UUID, FK → `contracted_services.id`), `client_id`, `provider_id` (service provider entity), `provider_slug` (`'netcred'`), `payment_token_id` (FK to `payment_tokens`), `installment_number`, `base_amount` (NUMERIC 12,2), `charge_scheduled_at` (TIMESTAMPTZ, UTC), `state` (`'SCHEDULED'`), `automatic_attempt_count` (SMALLINT, default 0), `manual_attempt_count` (SMALLINT, default 0), `max_attempts` (SMALLINT, from `platform_constants`), `locked_until` (TIMESTAMPTZ, NULL), `next_retry_at` (TIMESTAMPTZ, NULL), `idempotency_key` (TEXT, UNIQUE = `contracted_service_id`), `clearsale_session_id` (TEXT, the UUID from ClearSale SDK initialization **during card data entry**), `client_ip_address` (TEXT, IP captured at acceptance time), `upcoming_charge_notified_at` (TIMESTAMPTZ, NULL), `created_at`, `updated_at`.

**GIVEN** a `payment_schedules` record exists with `state = 'SCHEDULED'`  
**WHEN** the service is cancelled before `charge_scheduled_at`  
**THEN** the schedule MUST be transitioned to `CANCELLED` within the same database transaction as the service cancellation; `cancelled_at` and `cancellation_reason` MUST be set; no gateway interaction occurs.

**GIVEN** the service is rescheduled to a new `service_scheduled_at`  
**WHEN** rescheduling is confirmed and `payment_schedules.state ∈ {SCHEDULED, FAILED, IN_ANALYSIS}`  
**THEN** `charge_scheduled_at` MUST be updated to `MAX(now(), new_service_scheduled_at - interval '2 days')`; if `new_service_scheduled_at - now() < 48 hours`, `charge_scheduled_at = now()` (emergency scheduling); `upcoming_charge_notified_at` MUST be reset to NULL; `updated_at` MUST be refreshed; a `payment_audit_log` entry for `event_type = 'CHARGE_RESCHEDULED'` MUST be inserted with `old_charge_scheduled_at` and `new_charge_scheduled_at` in `metadata`; T-12h auto-cancellation MUST use the updated `service_scheduled_at`.

**GIVEN** a `payment_schedules` record is in `PAID` state  
**WHEN** the service is rescheduled  
**THEN** only `contracted_services.scheduled_at` is updated; `charge_scheduled_at` MUST be updated for audit purposes but has no operational effect; the schedule state MUST remain `PAID`; no new charge MUST be created; the provider receives a rescheduling notification from the rescheduling subsystem (not the payment system).

---

## Requirement 10: T-2 Charge Execution Cron

*User Story*: As the platform operations subsystem, I want the charge execution cron to reliably process all due payment schedules, execute gateway charges exactly once, and transition records to correct states, regardless of concurrent invocations or transient failures.

### Acceptance Criteria

**GIVEN** the `schedule-netcred-charges` cron fires  
**WHEN** it selects eligible records  
**THEN** the query MUST apply ALL of the following filters simultaneously: `state IN ('SCHEDULED', 'FAILED')` AND `automatic_attempt_count < max_attempts` AND `charge_scheduled_at::date <= CURRENT_DATE` AND `(locked_until IS NULL OR locked_until < now())` AND `(next_retry_at IS NULL OR next_retry_at <= now())` AND service status is not cancelled AND `payment_token_id IS NOT NULL` AND associated `provider_accounts.onboarding_status = 'ACTIVE'`.

**GIVEN** eligible records are identified  
**WHEN** the cron acquires a lease for one record  
**THEN** it MUST execute `SELECT ... FOR UPDATE SKIP LOCKED` within an explicit transaction; atomically set `state = 'PROCESSING'`, `locked_until = now() + '<payment_lease_duration_minutes> minutes'::interval`, `automatic_attempt_count = automatic_attempt_count + 1`; commit this transaction BEFORE making any gateway API calls.

**GIVEN** the lease is acquired and the gateway call is about to be made  
**WHEN** the final charge amount is computed and the `chargeCreate` payload is assembled  
**THEN** the cron MUST: (1) invoke the Postgres RPC `calculate_charge_amount(payment_token_id, base_amount, installment_number)` to compute `charge_amount` using current `platform_constants`; (2) set `orderInput.sessionId = payment_schedules.clearsale_session_id` (the UUID collected during client card data entry at checkout); (3) set `customerIpAddress = payment_schedules.client_ip_address`; (4) set `orderInput.referenceCode = contracted_service_id` (`contracted_services.id`); (5) populate `orderInput.orderItems` with service name, amount, and category; previously computed or cached amounts MUST NOT be used.

**GIVEN** `chargeCreate` returns `transactionState = 'PAID'`  
**WHEN** the success response is received  
**THEN** the cron MUST, in a single transaction: set `payment_schedules.state = 'PAID'`, `locked_until = NULL`, `paid_at = now()`, `paid_amount = charge_amount`, `provider_charge_id`, `provider_transaction_id`; set `contracted_services.status = 'CONFIRMED'`; insert a `payment_attempts` record with `outcome = 'PAID'`, `initiator = 'cron'`; insert a `payment_audit_log` entry; enqueue a success notification to client and provider.

**GIVEN** `chargeCreate` returns `transactionState = 'IN_ANALYSIS'` or `MANUAL_ANALYSIS`  
**WHEN** the antifraude response is received  
**THEN** the cron MUST set `state = 'IN_ANALYSIS'`, `locked_until = NULL`, persist `provider_charge_id` and `provider_transaction_id`; insert a `payment_attempts` record with `outcome = 'IN_ANALYSIS'`, `initiator = 'cron'`; insert an audit log entry; enqueue an "in review" notification to client; the webhook `TRANSACTION_CAPTURE` or `TRANSACTION_UPDATE` MUST be awaited to finalize state; `contracted_services.status` MUST remain `PENDING_PAYMENT` until `PAID` is confirmed.

**GIVEN** `chargeCreate` returns `transactionState = 'REJECTED'` (terminal error)  
**WHEN** the rejection is received  
**THEN** the cron MUST: set `state = 'FAILED_PERMANENT'`, `locked_until = NULL`, `failed_at = now()`, `failure_code`, `failure_reason`; insert a `payment_attempts` record with `outcome = 'REJECTED'`, `initiator = 'cron'`; insert an audit log entry; enqueue `FAILED_PERMANENT` notifications to client (Push + Email, bypass priority) AND to provider (Push, bypass priority); `automatic_attempt_count` MUST NOT be incremented for terminal errors.

**GIVEN** a retryable gateway error (network timeout, 5xx) occurs  
**WHEN** the error is received and `automatic_attempt_count < max_attempts`  
**THEN** the cron MUST: set `state = 'FAILED'`, `locked_until = NULL`, `next_retry_at = now() + '<charge_retry_interval_minutes> minutes'::interval`, `failure_code`, `failure_reason`; insert a `payment_attempts` record with `outcome = 'ERROR'`, `initiator = 'cron'`; insert an audit log entry; if this is the first failure (`automatic_attempt_count = 1`), enqueue failure notification to **client AND provider**; subsequent failures notify **client only**.

**GIVEN** a retryable error occurs AND `automatic_attempt_count >= max_attempts` after the increment  
**WHEN** the failure is processed  
**THEN** the cron MUST transition to `FAILED_PERMANENT` (not `FAILED`); all `FAILED_PERMANENT` consequences apply (escalated notifications, manual payment button enablement).

**GIVEN** a charge timeout occurs and transaction state is unknown  
**WHEN** the next cron execution picks up the record  
**THEN** it MUST call `getTransaction(referenceCode = contracted_service_id)` via the adapter FIRST; if the gateway confirms `PAID`, it MUST reconcile as success; if `null`, it MAY issue a new `chargeCreate`; this prevents double-charging on timeout recovery.

**GIVEN** a `referenceCode` conflict is returned by the gateway  
**WHEN** this error is detected  
**THEN** the adapter MUST call `getTransaction(referenceCode)` to retrieve the existing charge's state; the schedule MUST be updated to match the gateway state; no new charge MUST be issued.

**GIVEN** the cron processes multiple schedules per invocation  
**WHEN** one schedule's gateway call fails  
**THEN** the failure MUST NOT abort processing of remaining eligible schedules; each schedule MUST be processed independently with its own error boundary, Sentry span, and transaction scope.

---

## Requirement 11: Charge Retry Semantics and Error Classification

*User Story*: As the platform, I want failed charges to be automatically retried up to a configurable maximum with configurable intervals, while permanent failures are immediately surfaced to the client without wasting retry budget.

### Acceptance Criteria

**GIVEN** a `payment_schedules` record has `state = 'FAILED'` and `automatic_attempt_count < max_attempts` and `next_retry_at <= now()`  
**WHEN** the cron fires  
**THEN** the record MUST be selected and re-attempted; no manual state reset is required.

**GIVEN** `charge_retry_interval_minutes = 30` (default)  
**WHEN** a charge fails with a retryable error  
**THEN** `next_retry_at` MUST be set to `now() + interval '30 minutes'`; the cron MUST skip this record until `next_retry_at` lapses.

**GIVEN** a terminal gateway error occurs (e.g., `transactionState = 'REJECTED'`, `CPF_INVALID`, `BILLING_ADDRESS_MISSING`, `CARD_NOT_FOUND`)  
**WHEN** it is received on any attempt number  
**THEN** the system MUST classify the error as terminal and transition immediately to `FAILED_PERMANENT`; remaining retry budget MUST be abandoned; the `failure_code` in `payment_attempts` MUST carry the specific terminal error code for diagnostic purposes.

**GIVEN** `max_charge_attempts = 3` and all 3 automatic retryable attempts have failed  
**WHEN** the third failure is processed  
**THEN** `automatic_attempt_count = 3`, `state = 'FAILED_PERMANENT'`, `failed_permanently_at = now()` MUST be committed; no further automatic retry MUST occur; manual client retries remain available until T-12h.

**GIVEN** a schedule is in `FAILED_PERMANENT` or `FAILED` and the client initiates a manual payment  
**WHEN** the `manual-charge-payment` Edge Function is invoked  
**THEN** the manual attempt MUST increment `manual_attempt_count`, set `state = 'PROCESSING'`, acquire a lease, and execute the charge exactly as the cron would; success transitions to `PAID` and sets `contracted_services.status = 'CONFIRMED'`; failure with a terminal error remains `FAILED_PERMANENT` (or `FAILED` if not yet permanent); failure with a retryable error transitions to `FAILED` with `automatic_attempt_count = max_attempts` (no further automatic retries, but additional manual retries are permitted); manual attempts MUST NOT increment `automatic_attempt_count`; automatic cron retries on `FAILED` continue in parallel until exhausted.

**GIVEN** a client attempts manual payment with a replacement card  
**WHEN** the new card is tokenized and selected  
**THEN** the system MUST create a new `payment_tokens` record and update `payment_schedules.payment_token_id` to the new token before executing the charge; `payment_audit_log` MUST record the card replacement event.

**GIVEN** `max_charge_attempts` is updated in `platform_constants`  
**WHEN** existing `FAILED` schedules are re-evaluated  
**THEN** they MUST be reconsidered using the NEW limit applied to `automatic_attempt_count`; a previously-exhausted schedule that now has remaining budget MUST be eligible for retry on the next cron execution.

---

## Requirement 12: Payment Success and Failure Notifications

*User Story*: As a client and service provider, I want to receive immediate, clear notifications for every payment lifecycle event so that I can take timely action when required.

### Acceptance Criteria

**GIVEN** a charge succeeds (`state` transitions to `PAID`)  
**WHEN** the success is committed  
**THEN** the system MUST enqueue via the Multichannel Message Dispatcher: (1) a Push notification to the client confirming payment, including service name, scheduled date, charged amount, and installment summary; (2) an Email to the client with the same information; both MUST use bypass priority.

**GIVEN** a charge fails and `state` transitions to `FAILED` (retryable, not yet permanent)  
**WHEN** the failure is committed  
**THEN** the system MUST enqueue a Push notification AND Email to the client informing them: (a) the payment could not be processed, (b) the system will retry automatically, (c) remaining retry count, (d) the service name and date, (e) a deep link to the service detail screen.

**GIVEN** `state` transitions to `FAILED_PERMANENT`  
**WHEN** the permanent failure is committed  
**THEN** the system MUST enqueue: (1) Push + Email to the client (bypass priority) explaining: payment has failed permanently, manual payment is required via the service screen, the service may be auto-cancelled at T-12h if payment is not resolved; (2) Push to the provider (bypass priority) informing them that the client's payment has failed and service delivery is conditional on payment resolution.

**GIVEN** a charge enters `IN_ANALYSIS`  
**WHEN** the antifraude state is committed  
**THEN** the client MUST receive a Push notification informing them that their payment is under review; NO auto-cancellation timing MUST be triggered during this state.

**GIVEN** the first charge attempt for a service fails (any failure type)  
**WHEN** the failure notification is dispatched to the provider  
**THEN** the notification content MUST be non-financial (no charge amounts), stating only that client payment is pending and that the platform will keep them informed.

**GIVEN** a manual charge succeeds from the client UI  
**WHEN** the success is committed  
**THEN** both client (Push + Email) and provider (Push) MUST be notified that payment was confirmed and service execution may proceed.

---

## Requirement 13: Manual Payment Recovery Flow

*User Story*: As a client whose automatic payment has failed, I want a manual payment button in my service detail screen so that I can retry payment or update my payment method at my own initiative — without waiting for all automatic retries to exhaust.

### Acceptance Criteria

**GIVEN** `payment_schedules.state ∈ {'FAILED', 'FAILED_PERMANENT'}`  
**WHEN** the client views the service detail screen  
**THEN** the UI MUST display a prominent "Efetuar Pagamento" button; this button MUST NOT render when state is `SCHEDULED`, `PROCESSING`, `PAID`, `CANCELLED`, or `IN_ANALYSIS`.

**GIVEN** the client taps "Efetuar Pagamento"  
**WHEN** the manual charge flow initiates  
**THEN** the client MUST be presented with: (1) their current saved card (or a "Change card" option), (2) their current installment selection (or option to modify), (3) the fee-inclusive amount to be charged; upon confirmation, `manual-charge-payment` Edge Function MUST be invoked.

**GIVEN** `manual-charge-payment` is invoked  
**WHEN** it validates preconditions  
**THEN** it MUST verify: `payment_schedules.state ∈ {'FAILED', 'FAILED_PERMANENT'}` (reject with HTTP 409 if not); service is not cancelled; T-12h threshold has not passed; a fresh `clearsale_session_id` MUST be collected and persisted before `chargeCreate` (per Requirement 31).

**GIVEN** manual charge succeeds  
**WHEN** `transactionState = 'PAID'`  
**THEN** `payment_schedules.state` MUST transition to `PAID`; client and provider MUST receive success notifications; the "Efetuar Pagamento" button MUST disappear on the next screen refresh.

**GIVEN** manual charge fails with a terminal error  
**WHEN** the gateway returns `REJECTED`  
**THEN** the inline UI MUST display the error reason in plain Portuguese; the client MUST be offered: "Try with a different card" (re-tokenization flow inline) and "Contact support" option.

**GIVEN** the T-12h auto-cancellation threshold has passed (`service_scheduled_at - now() <= 12 hours`)  
**WHEN** the client attempts a manual payment  
**THEN** the server MUST return HTTP 409 with `error_code: 'SERVICE_AUTO_CANCELLED'`; the UI MUST inform the client that the service was already cancelled due to payment non-resolution.

---

## Requirement 14: Auto-Cancellation at T-12h for Non-Payment

*User Story*: As the platform, I want services with unresolved payment failures to be automatically cancelled 12 hours before service execution to protect providers from last-minute no-shows caused by payment issues.

### Acceptance Criteria

**GIVEN** the `auto-cancel-unpaid-services` cron fires (minimum 4x/day, same schedule as charge cron)  
**WHEN** it selects records for auto-cancellation  
**THEN** it MUST select `contracted_services` records WHERE `service_scheduled_at - now() <= interval '12 hours'` AND `payment_schedules.state IN ('FAILED_PERMANENT', 'FAILED', 'SCHEDULED')` AND `contracted_services.status NOT IN ('CANCELLED', 'COMPLETED')`.

**GIVEN** eligible records are selected  
**WHEN** auto-cancellation is executed due to non-payment  
**THEN** the system MUST atomically in a single transaction: (1) transition `contracted_services.status = 'CANCELLED'`, `cancellation_reason = 'NON_PAYMENT'`, (2) transition `payment_schedules.state = 'CANCELLED'`, `cancelled_at = now()`, `cancellation_reason = 'NON_PAYMENT'`, (3) insert audit log entries for both entities.

**GIVEN** auto-cancellation is committed  
**WHEN** notifications are dispatched  
**THEN** the system MUST enqueue (bypass priority): (1) Push + Email to client explaining the service was cancelled due to unpaid payment, offering support contact; (2) Push to provider informing them the service was cancelled and they are freed from the commitment.

**GIVEN** `payment_schedules.state = 'IN_ANALYSIS'` when T-12h is reached  
**WHEN** the auto-cancellation cron evaluates the record  
**THEN** it MUST NOT cancel; `IN_ANALYSIS` represents an in-progress antifraude review, not a payment failure; the cron MUST skip this record.

**GIVEN** `payment_schedules.state = 'PAID'` when T-12h is evaluated  
**WHEN** the cron evaluates the record  
**THEN** the cron MUST skip the record; paid services MUST never be auto-cancelled by the payment subsystem.

**GIVEN** the auto-cancellation cron may execute multiple times  
**WHEN** it attempts to cancel an already-cancelled service  
**THEN** the operation MUST be idempotent; detecting `contracted_services.status = 'CANCELLED'` MUST cause a no-op without error or duplicate notifications.

**GIVEN** a provider's `onboarding_status = 'SUSPENDED'` and a service is in `PENDING_PAYMENT` state  
**WHEN** `service_scheduled_at - now() <= 12 hours` is reached  
**THEN** the system MUST atomically cancel the service with `contracted_services.status = 'CANCELLED'`, `cancellation_reason = 'PROVIDER_SUSPENDED'`, and `payment_schedules.state = 'CANCELLED'`; no charge has occurred, so no refund is issued; client MUST be notified that the service was cancelled due to provider account status, and offered support contact.

---

## Requirement 15: Service Cancellation and Refund Rules

*User Story*: As a client needing to cancel a charged service, I want the platform to process the correct refund amount according to Terms of Service §2.2 cancellation policy, automatically and without support intervention.

### Acceptance Criteria

**GIVEN** a client cancels a service where `payment_schedules.state = 'PAID'` AND `service_scheduled_at - now() > 48 hours`  
**WHEN** the cancellation is confirmed  
**THEN** the system MUST compute `refund_amount = base_amount` (100% of service price; card processing fees are non-refundable); invoke `transactionRefund(transactionId, amount = refund_amount, reason = 'REQUESTED_BY_CUSTOMER')`; transition `payment_schedules.state = 'REFUND_REQUESTED'`; the gateway distributes the refund proportionally between all `isLiable` accounts (provider and Renovi).

**GIVEN** a client cancels a service where `payment_schedules.state = 'PAID'` AND `12 hours <= service_scheduled_at - now() <= 48 hours`  
**WHEN** the cancellation is confirmed  
**THEN** the system MUST compute `refund_amount = base_amount × 0.90` (90% of service price; 10% penalty retained; card processing fees non-refundable); invoke `transactionRefund` for `refund_amount`; transition `payment_schedules.state = 'REFUND_REQUESTED'`; the 10% penalty retention and the non-refundable card fee MUST be documented in the `payment_audit_log`; the gateway distributes the refund proportionally between all `isLiable` accounts.

**GIVEN** a client cancels a service where `payment_schedules.state = 'PAID'` AND `service_scheduled_at - now() < 12 hours`  
**WHEN** the cancellation is confirmed  
**THEN** the system MUST compute `refund_amount = base_amount × 0.70` (70% of service price; 30% penalty retained; card processing fees non-refundable); invoke `transactionRefund` for `refund_amount`; transition `payment_schedules.state = 'REFUND_REQUESTED'`; the gateway distributes the refund proportionally between all `isLiable` accounts.

**GIVEN** a cancellation occurs before T-2 (`payment_schedules.state = 'SCHEDULED'`)  
**WHEN** the service is cancelled (any `contracted_services.status` in `PENDING_PAYMENT`)  
**THEN** `payment_schedules.state` MUST transition to `CANCELLED` without any gateway interaction; `transactionRefund` MUST NOT be called; no penalty applies; the `payment_audit_log` entry MUST confirm no charge was executed.

**GIVEN** a client or provider cancels a service in `CONFIRMED` or `EXECUTED` status (`payment_schedules.state = 'PAID'`)  
**WHEN** the cancellation is confirmed  
**THEN** the same ToS §2.2 penalty rules apply as for `CONFIRMED` (refund computed on `base_amount` by time window); `EXECUTED` does not change refund eligibility or penalty percentages.

**GIVEN** a client or provider attempts to cancel a service in `COMPLETED` status  
**WHEN** the cancellation RPC is invoked  
**THEN** the system MUST return HTTP 409 with `error_code: 'SERVICE_NOT_CANCELLABLE'`; no refund is processed via the app.

**GIVEN** `payment_schedules.state = 'IN_ANALYSIS'`  
**WHEN** a client or provider attempts cancellation  
**THEN** cancellation MUST be blocked with HTTP 409 and `error_code: 'PAYMENT_IN_ANALYSIS'`; the service remains `PENDING_PAYMENT`; auto-cancellation at T-12h is suspended until antifraude resolves.

**GIVEN** `payment_schedules.state ∈ {'FAILED', 'FAILED_PERMANENT'}` and `contracted_services.status = 'PENDING_PAYMENT'`  
**WHEN** the client cancels before T-12h  
**THEN** cancellation is free: `contracted_services.status = 'CANCELLED'`, `cancellation_reason = 'CLIENT_INITIATED'`, `payment_schedules.state = 'CANCELLED'`; no refund (no charge occurred).

**GIVEN** the service provider cancels the service (any timing)  
**WHEN** `payment_schedules.state = 'PAID'`  
**THEN** the system MUST execute a full refund (`refund_amount = charge_amount`, i.e., the full amount debited from the client's card including card processing fees) regardless of timing; no penalty applies for provider-initiated cancellations; the gateway distributes the refund proportionally between all `isLiable` accounts (provider absorbs their proportional share of the clawback).

**GIVEN** `transactionRefund` is submitted  
**WHEN** the response is received from the gateway  
**THEN** `payment_schedules.state` MUST remain `REFUND_REQUESTED` until the webhook `TRANSACTION_REFUND` confirms the refund; only upon webhook confirmation MUST the state transition to `REFUNDED` (100%) or `PARTIALLY_REFUNDED` (partial); the client MUST be informed that refund processing takes 30–60 days on their statement.

**GIVEN** `transactionRefund` fails (e.g., `TRANSACTION_INVALID_REFUND_AMOUNT`, already refunded)  
**WHEN** the error is received  
**THEN** the system MUST: (1) NOT mark the payment as refunded, (2) emit a `CRITICAL` Sentry alert, (3) persist the error in `payment_audit_log`, (4) surface a support escalation link in the client's service detail screen.

---

## Requirement 16: Webhook Ingestion and Signature Validation

*User Story*: As the webhook processing subsystem, I want every incoming webhook from NetCred to be authenticated via HMAC signature before processing so that forged or replayed events cannot alter payment state.

### Acceptance Criteria

**GIVEN** a webhook POST arrives at the `netcred-webhook` Edge Function  
**WHEN** the request is received  
**THEN** the function MUST persist the raw payload (`req.text()`) and all relevant headers to `payment_webhook_events` with `state = 'RECEIVED'` BEFORE any validation or processing; this ensures no event is lost even if subsequent processing fails.

**GIVEN** the payload is persisted  
**WHEN** signature validation begins  
**THEN** the function MUST compute `HMAC-SHA256(secretKey, rawBody)` where `secretKey` is read from Supabase Vault; it MUST compare the computed hex digest to the value in `X-NETCRED-Signature` using a constant-time comparison function (e.g., `crypto.timingSafeEqual`) to prevent timing side-channel attacks.

**GIVEN** the HMAC comparison fails  
**WHEN** the mismatch is detected  
**THEN** the function MUST: (1) update `payment_webhook_events.state = 'FAILED'` with `failure_reason = 'INVALID_SIGNATURE'`, (2) emit a `WARN` Sentry event with `{ event_type: X-NETCRED-Event, source_ip }`, (3) return HTTP 401; it MUST NOT process the payload.

**GIVEN** signature validation passes  
**WHEN** `X-NETCRED-Event` is parsed  
**THEN** the function MUST dispatch to a per-event handler; unknown event types MUST be logged as `WARN` and acknowledged with HTTP 200 (no-op); the system MUST be designed to tolerate new event types without crashing.

**GIVEN** webhook processing is expected to exceed the Edge Function response time budget  
**WHEN** the event requires complex state reconciliation  
**THEN** the function MUST enqueue the event to `payment_webhook_processing_queue` and return HTTP 200 immediately; heavy processing MUST occur in a separate background worker invoked by `pg_cron`.

---

## Requirement 17: Webhook Idempotent Processing

*User Story*: As the webhook handler, I want duplicate webhook deliveries to be safely detected and ignored so that gateway retry behavior does not cause duplicate state transitions, duplicate notifications, or duplicate charges.

### Acceptance Criteria

**GIVEN** a webhook event is inserted into `payment_webhook_events`  
**WHEN** the insert is executed  
**THEN** the UNIQUE constraint on `(provider_slug, event_type, provider_event_id)` MUST be evaluated; a duplicate insert MUST trigger a controlled conflict handling path (e.g., `ON CONFLICT DO NOTHING` followed by a state check).

**GIVEN** a duplicate webhook is confirmed  
**WHEN** the handler identifies the existing record  
**THEN** it MUST: update `is_duplicate = true` on the existing or new record, return HTTP 200 immediately, log `{ is_duplicate: true, provider_event_id, event_type }`; it MUST NOT re-execute any state machine transition or re-enqueue notifications.

**GIVEN** a webhook event arrives out of order (e.g., `TRANSACTION_REFUND` before `TRANSACTION_CAPTURE` in a reconciliation edge case)  
**WHEN** the handler resolves the target `payment_schedules` record  
**THEN** it MUST check the current `state`; if applying the event would cause a regression in the state machine (e.g., transitioning from `PAID` to `IN_ANALYSIS`), the transition MUST be skipped; the event MUST still be marked `PROCESSED`.

**GIVEN** a `TRANSACTION_CAPTURE` event arrives for a schedule already in `PAID`  
**WHEN** the handler processes it  
**THEN** it MUST update only safe monotonic fields (e.g., `webhook_confirmed_at`) without altering `state`; the event MUST be marked `PROCESSED`, not `DUPLICATE`, as it is a valid but redundant confirmation.

**GIVEN** a `PAYMENT_PROFILE_DELETE` webhook is received  
**WHEN** the handler processes it  
**THEN** the corresponding `payment_tokens` record MUST be set to `state = 'REVOKED'`; if linked to a `SCHEDULED` or `FAILED` `payment_schedules` record, the client MUST be notified to update their payment method; the `payment_schedules` record MUST be flagged with `needs_payment_method_update = true`.

---

## Requirement 18: Webhook Event Catalog and State Reconciliation

*User Story*: As the platform, I want every NetCred webhook event to be mapped to a specific internal action so that the payment state machine remains synchronized with gateway state at all times.

### Acceptance Criteria

**GIVEN** a `TRANSACTION_CAPTURE` event with `transactionState = 'PAID'`  
**WHEN** the handler processes it  
**THEN** `payment_schedules.state` MUST transition to `PAID`; `contracted_services.status` MUST transition to `CONFIRMED` in the same transaction; `charge_captured_at`, `paid_amount`, `provider_transaction_id` MUST be persisted; a success notification MUST be enqueued for client and provider.

**GIVEN** a `TRANSACTION_UPDATE` event is received  
**WHEN** `transactionState` maps to a known internal state  
**THEN** the handler MUST apply the full corresponding state machine transition; `TRANSACTION_UPDATE` MUST act as a universal fallback reconciliation event for all transaction state changes.

**GIVEN** a `CHARGE_VOID` event is received  
**WHEN** the handler processes it  
**THEN** `payment_schedules.state` MUST transition to `VOIDED`; `voided_at` MUST be set.

**GIVEN** a `TRANSACTION_DISPUTE` (chargeback) event is received  
**WHEN** the handler processes it  
**THEN** `payment_schedules.is_disputed = true` MUST be set; a `CRITICAL` Sentry alert MUST be emitted; the operations team MUST be notified via a structured alert including `contracted_service_id` and `provider_transaction_id`; `contracted_services.status` MUST NOT change automatically — the service MUST continue in its current status (`CONFIRMED`, `EXECUTED`, etc.) pending manual ops resolution. Automated dispute resolution (e.g., auto-cancel on chargeback) is out of MVP scope.

**GIVEN** a `TRANSACTION_REFUND` event is received  
**WHEN** the handler processes it and `transactionState = 'REFUNDED'`  
**THEN** `payment_schedules.state` MUST transition from `REFUND_REQUESTED` to `REFUNDED`; `refund_confirmed_at` and `refunded_amount` MUST be persisted; the client MUST be notified of refund confirmation with the expected statement processing timeline (30–60 days).

**GIVEN** a `PAYMENT_PROFILE_EXPIRING` event is received  
**WHEN** the handler resolves affected future charge schedules  
**THEN** for each `payment_schedules` record in `SCHEDULED` state linked to the expiring token, the client MUST be notified to update their payment method before `charge_scheduled_at`.

**GIVEN** an unrecognized `X-NETCRED-Event` value  
**WHEN** the handler dispatches it  
**THEN** it MUST log a structured `WARN` entry with the full event type and payload; it MUST return HTTP 200; it MUST NOT raise an unhandled exception; future event type additions MUST require only adding a new handler branch.

---

## Requirement 19: Webhook Dead Letter Queue and Failure Recovery

*User Story*: As the operations team, I want persistently failed webhook events to be escalated with alerting so that critical payment events (refunds, disputes, captures) are never silently lost.

### Acceptance Criteria

**GIVEN** a webhook event processing fails (exception, DB error, adapter error)  
**WHEN** the failure is caught  
**THEN** `payment_webhook_events.state` MUST transition to `'FAILED'`; `failure_reason` (exception message + stack trace excerpt) MUST be recorded; `retry_count` MUST be incremented.

**GIVEN** a failed event has `retry_count < 3`  
**WHEN** the `process-webhook-retry` cron fires  
**THEN** the event MUST be re-queued; `next_retry_at` MUST follow exponential backoff: `base_interval_minutes × 2^(retry_count - 1)` (base: 5 minutes); first retry at T+5min, second at T+10min, third at T+20min.

**GIVEN** a webhook event has `retry_count >= 3` and continues to fail  
**WHEN** the retry limit is exhausted  
**THEN** the event MUST transition to `state = 'DEAD_LETTER'`; a `CRITICAL` Sentry alert MUST be raised with: event type, `provider_event_id`, `payment_schedules` reference (if resolvable), failure reason.

**GIVEN** an operator manually resets a dead-lettered event  
**WHEN** `state` is set to `'RECEIVED'` and `retry_count = 0`  
**THEN** the next retry cron MUST pick up the event and reprocess it; due to idempotency constraints, safe reprocessing is guaranteed.

---

## Requirement 20: Payment Reconciliation Polling (Webhook Fallback)

*User Story*: As the payment operations subsystem, I want a background cron to actively poll the gateway for payment records stuck in intermediate states so that missed webhook deliveries do not leave the system inconsistent indefinitely.

### Acceptance Criteria

**GIVEN** the `reconcile-netcred-payments` cron fires every 30 minutes  
**WHEN** it queries for stale intermediate records  
**THEN** it MUST select `payment_schedules` WHERE `state IN ('IN_ANALYSIS', 'PROCESSING', 'REFUND_REQUESTED')` AND `updated_at < now() - interval '30 minutes'`.

**GIVEN** a stale `IN_ANALYSIS` record is found  
**WHEN** the cron calls `getTransaction(referenceCode = contracted_service_id)` via the adapter  
**THEN** if the gateway returns `PAID`: MUST apply the full `PAID` transition (identical to the webhook path); if `REJECTED`: MUST apply `FAILED_PERMANENT` transition; if `null`: MUST log a `WARN` and increment `reconciliation_failure_count`.

**GIVEN** `getTransaction` fails with a network error  
**WHEN** the failure is caught  
**THEN** the record MUST remain in its current state; `reconciliation_failure_count` MUST be incremented; a `WARN` Sentry event MUST be emitted when `reconciliation_failure_count > 3` for the same record.

**GIVEN** a stale `REFUND_REQUESTED` record is found  
**WHEN** the cron calls `getTransaction`  
**THEN** if the gateway confirms `REFUNDED` or `PARTIALLY_REFUNDED`, the corresponding state transition MUST be applied as if the webhook had been received.

---

## Requirement 21: Observability — Sentry Integration

*User Story*: As the engineering and SRE team, I want all payment system events to emit Sentry traces and alerts so that incidents can be diagnosed through Sentry alone without requiring database forensics.

### Acceptance Criteria

**GIVEN** any payment Edge Function is invoked  
**WHEN** the function initializes  
**THEN** it MUST initialize a Sentry transaction with: operation name, `service_id` tag, `provider_slug` tag, `environment` tag.

**GIVEN** a charge attempt executes  
**WHEN** the gateway call completes (success or failure)  
**THEN** a Sentry span MUST be finalized with: `gateway_latency_ms`, `transaction_state`, `charge_amount`, `attempt_number`, `schedule_id`, `provider_charge_id` (if obtained).

**GIVEN** any unhandled exception occurs in a payment Edge Function  
**WHEN** caught  
**THEN** it MUST be captured via `Sentry.captureException` with extra context: `{ schedule_id, contracted_service_id, automatic_attempt_count, provider_slug, error_code, current_state }`.

**GIVEN** a `FAILED_PERMANENT` transition is committed  
**WHEN** logged to Sentry  
**THEN** Sentry MUST emit a `WARNING`-level event with all previous attempt `failure_code` values in `extra` for pattern analysis.

**GIVEN** a webhook reaches `DEAD_LETTER` state  
**WHEN** the transition is committed  
**THEN** Sentry MUST emit a `CRITICAL` alert; the alerting rule MUST notify the on-call channel within 5 minutes.

**GIVEN** a gateway authentication failure occurs  
**WHEN** `tokenAuth` fails  
**THEN** Sentry MUST emit a `CRITICAL` alert; all on-call personnel MUST be notified as this blocks all payment processing.

**GIVEN** the auto-cancellation cron cancels a service at T-12h  
**WHEN** the cancellation is committed  
**THEN** Sentry MUST emit a `WARNING` event with `service_id`, `schedule_id`, `last_failure_reason`.

---

## Requirement 22: Structured Audit Logging

*User Story*: As the compliance and operations team, I want every payment state transition and gateway interaction to be immutably recorded so that disputes and regulatory inquiries can be fully resolved from the database record alone.

### Acceptance Criteria

**GIVEN** any `payment_schedules` state transition occurs  
**WHEN** committed to the database  
**THEN** the same transaction MUST INSERT into `payment_audit_log`: `event_type`, `entity_type = 'payment_schedule'`, `entity_id = schedule_id`, `service_id`, `from_state`, `to_state`, `actor` (`'cron' | 'client' | 'webhook' | 'support' | 'system'`), `actor_id` (user UUID if applicable), `metadata` (JSONB: attempt number, gateway response codes, error messages, `charge_amount`), `created_at` (set by DB, not application).

**GIVEN** a refund is processed  
**WHEN** `transactionRefund` is submitted  
**THEN** `payment_audit_log` MUST record: `event_type = 'REFUND_SUBMITTED'`, `refund_amount`, `refund_reason`, `refunded_by` (initiator), `provider_transaction_id`.

**GIVEN** a client accepts ToS at checkout  
**WHEN** they advance past the card step  
**THEN** `payment_audit_log` MUST record: `event_type = 'PAYMENT_TERMS_ACCEPTED'`, `actor = 'client'`, `metadata.provider_slug`, `metadata.accepted_at`.

**GIVEN** the `payment_audit_log` table is queried  
**WHEN** queried for a specific `service_id` or `schedule_id`  
**THEN** all entries MUST be returned in chronological order; the complete payment lifecycle MUST be reconstructable from these entries alone.

**GIVEN** the `payment_audit_log` table is INSERT-only  
**WHEN** database permissions are configured  
**THEN** application roles MUST have INSERT and SELECT only; UPDATE and DELETE MUST be denied; audit records MUST be immutable.

---

## Requirement 23: Concurrency Control and Race Condition Prevention

*User Story*: As the distributed systems architect, I want the scheduling system to guarantee exactly-once charge execution semantics regardless of concurrent cron invocations, parallel Edge Function instances, or network race conditions.

### Acceptance Criteria

**GIVEN** two concurrent cron invocations attempt to process the same `payment_schedule`  
**WHEN** both issue the dequeue query simultaneously  
**THEN** `SELECT ... FOR UPDATE SKIP LOCKED` MUST ensure only one worker acquires the row; the second MUST skip to the next eligible record without error.

**GIVEN** a worker acquires a lease and crashes before committing the final state  
**WHEN** `locked_until` expires  
**THEN** the janitor cron MUST transition the record: if `automatic_attempt_count = 0`, back to `SCHEDULED`; if `automatic_attempt_count > 0`, to `FAILED`; the next cron execution MUST then process it normally.

**GIVEN** the NetCred API enforces `referenceCode` uniqueness  
**WHEN** a second `chargeCreate` is issued for the same `referenceCode` due to a retry  
**THEN** the adapter MUST detect the specific error code and call `getTransaction(referenceCode)` to retrieve the existing charge; no second charge MUST be created.

**GIVEN** manual payment and cron attempt concurrent execution for the same schedule  
**WHEN** both attempt `SELECT ... FOR UPDATE`  
**THEN** the second accessor MUST encounter the held lock and either wait (if short timeout) or abort with a concurrency error to the caller; the caller (manual payment API) MUST return HTTP 409 with `error_code: 'PAYMENT_ALREADY_IN_PROGRESS'`.

**GIVEN** `automatic_attempt_count` is incremented during lease acquisition  
**WHEN** the increment is executed  
**THEN** it MUST be atomic within the same transaction as `state = 'PROCESSING'`; separate UPDATE statements for `automatic_attempt_count` and `state` MUST NOT be used.

---

## Requirement 24: PCI DSS Compliance and Security Controls

*User Story*: As the security and compliance officer, I want the payment system to conform to PCI DSS requirements so that Renovi does not incur obligations for storing, processing, or transmitting raw cardholder data.

### Acceptance Criteria

**GIVEN** a client submits card data in the checkout form  
**WHEN** the data is transmitted  
**THEN** raw card data (PAN, CVV, expiry) MUST travel only from the client browser/app to the `tokenize-payment-card` Edge Function over HTTPS; the data MUST NOT be logged, stored in React Query cache, persisted in IndexedDB, or transmitted to any other endpoint.

**GIVEN** `payment_tokens` table schema is inspected  
**WHEN** audited for PCI compliance  
**THEN** the table MUST NOT contain columns for raw PAN or CVV; it MUST contain ONLY tokenized references: `provider_payment_profile_id`, `card_number_masked`, `card_brand`, `provider_card_token`, `expiry_month`, `expiry_year`, `cardholder_name`.

**GIVEN** the `X-NETCRED-Signature` is validated  
**WHEN** the HMAC comparison is performed  
**THEN** the implementation MUST use `crypto.timingSafeEqual` (or equivalent constant-time function) to prevent timing-based side-channel attacks.

**GIVEN** the webhook endpoint `netcred-webhook` is publicly accessible  
**WHEN** receiving requests  
**THEN** it MUST reject requests with invalid or missing signatures with HTTP 401; it MUST apply rate limiting (via `platform_rate_limits`) to prevent signature brute-force attacks.

**GIVEN** the `INSTALLMENT_SIGNING_SECRET` is required  
**WHEN** it is accessed  
**THEN** it MUST be read from Supabase Vault; it MUST be rotatable by updating the Vault secret and redeploying the Edge Function; a rotation MUST NOT require a database migration.

**GIVEN** `payment_tokens` RLS policies are applied  
**WHEN** a query is executed  
**THEN** only the owning client (`auth.uid() = client_id`) MUST be able to SELECT their own tokens via the client-facing API; providers and anonymous users MUST receive zero rows; Edge Functions with `service_role` access MUST scope queries by `client_id` explicitly.

**GIVEN** NetCred credentials are required  
**WHEN** Edge Functions access them  
**THEN** they MUST be read from Supabase Vault at runtime; they MUST NOT be present in `.env` files, source code, or any client-accessible key-value store.

---

## Requirement 25: Platform Constants for Fee and Limit Configuration

*User Story*: As the product and operations team, I want all payment fees and operational thresholds to be configurable via the database so that business parameters can be adjusted without code deployments.

### Acceptance Criteria

**GIVEN** installment fee rates are updated in `platform_constants`  
**WHEN** the next `calculate-installment-options` or `calculate_charge_amount` execution runs  
**THEN** the updated rates MUST take effect immediately without Edge Function redeployment.

**GIVEN** `platform_constants` defines credit card fee rates  
**WHEN** the rows are validated  
**THEN** the following keys MUST exist: `cc_visa_master_1x_rate` (2.39), `cc_visa_master_2_6x_rate` (2.59), `cc_visa_master_7_12x_rate` (2.79), `cc_elo_other_1x_rate` (2.69), `cc_elo_other_2_6x_rate` (2.89), `cc_elo_other_7_12x_rate` (3.19), `cc_fixed_processing_fee_brl` (0.39); all stored as NUMERIC.

**GIVEN** `platform_constants` defines operational limits  
**WHEN** the rows are validated  
**THEN** the following keys MUST exist: `max_charge_attempts` (3), `charge_retry_interval_minutes` (30), `payment_lease_duration_minutes` (10), `provider_onboarding_batch_size` (50), `auto_cancel_hours_before_service` (12), `scheduled_charge_hours_before_service` (48), `installment_hmac_expires_minutes` (10), `reconciliation_poll_interval_minutes` (30), `webhook_base_retry_interval_minutes` (5).

**GIVEN** a constant key is absent from `platform_constants`  
**WHEN** an Edge Function or RPC reads it  
**THEN** it MUST fall back to a safe hardcoded default; the absence of a row MUST NOT cause a runtime exception; the fallback MUST be logged as a `WARN`.

**GIVEN** fee rates are stored as percentages in `platform_constants`  
**WHEN** `calculate_charge_amount` applies them  
**THEN** the computation MUST be: `final_amount = ROUND((base_amount * (1 + rate/100)) + fixed_fee, 2)` where `ROUND` uses ROUND_HALF_UP semantics; the formula MUST be identical between the Edge Function and the PostgreSQL RPC.

---

## Requirement 26: Payment Data Model

*User Story*: As the data architect, I want a complete, normalized schema for the payment system that supports operational queries, auditing, and future payment method extensions without requiring breaking schema changes.

### Acceptance Criteria

**GIVEN** `payment_providers` table is created  
**WHEN** NetCred is registered  
**THEN** it MUST contain: `id` (UUID, PK), `slug` (TEXT, UNIQUE), `display_name`, `is_active` (BOOLEAN), `supported_methods` (TEXT[], e.g., `['CREDIT_CARD']`), `api_base_url`, `webhook_handler_path`, `created_at`.

**GIVEN** `payment_tokens` table is created  
**WHEN** a card is tokenized  
**THEN** it MUST contain: `id` (UUID, PK), `client_id` (UUID, FK → `profiles`), `provider_id` (UUID, FK → `payment_providers`), `provider_payment_profile_id` (TEXT), `card_number_masked` (TEXT), `card_brand` (TEXT), `provider_card_token` (TEXT), `expiry_month` (SMALLINT), `expiry_year` (SMALLINT), `cardholder_name` (TEXT), `billing_address` (JSONB), `state` (TEXT, CHECK IN ('ACTIVE','EXPIRED','REVOKED','TOKENIZATION_FAILED')), `created_at`, `updated_at`; UNIQUE on `(client_id, provider_payment_profile_id)`.

**GIVEN** `payment_schedules` table is created  
**WHEN** a charge is scheduled  
**THEN** it MUST contain: `id` (UUID, PK), `contracted_service_id` (UUID, FK → `contracted_services.id`), `client_id` (UUID), `provider_id` (UUID, service provider), `provider_slug` (TEXT), `payment_token_id` (UUID, FK → `payment_tokens`), `installment_number` (SMALLINT, 1–12), `base_amount` (NUMERIC 12,2), `charge_scheduled_at` (TIMESTAMPTZ), `state` (TEXT, state machine), `automatic_attempt_count` (SMALLINT, default 0), `manual_attempt_count` (SMALLINT, default 0), `max_attempts` (SMALLINT), `locked_until` (TIMESTAMPTZ), `next_retry_at` (TIMESTAMPTZ), `idempotency_key` (TEXT, UNIQUE = `contracted_service_id`), `clearsale_session_id` (TEXT, nullable — the UUID collected during client card data entry at checkout; passed as `orderInput.sessionId` in `chargeCreate`), `client_ip_address` (TEXT, nullable — IP of the client at acceptance time; passed as `customerIpAddress` in `chargeCreate`), `upcoming_charge_notified_at` (TIMESTAMPTZ, nullable — set when 24h pre-charge Push+Email is sent), `is_disputed` (BOOLEAN, default FALSE), `provider_charge_id` (TEXT), `provider_transaction_id` (TEXT), `paid_at`, `failed_at`, `cancelled_at`, `refunded_at`, `paid_amount` (NUMERIC 12,2), `refunded_amount` (NUMERIC 12,2), `failure_code` (TEXT), `failure_reason` (TEXT), `cancellation_reason` (TEXT), `created_at`, `updated_at`.

**GIVEN** `payment_attempts` table is created  
**WHEN** a charge attempt is made  
**THEN** it MUST contain: `id` (UUID, PK), `schedule_id` (UUID, FK → `payment_schedules`), `attempt_number` (SMALLINT), `initiator` (TEXT: `'cron' | 'client'`), `initiated_at` (TIMESTAMPTZ), `completed_at` (TIMESTAMPTZ), `outcome` (TEXT: `PAID | REJECTED | TIMEOUT | ERROR | IN_ANALYSIS | VOIDED`), `provider_response_summary` (JSONB), `failure_code` (TEXT), `failure_reason` (TEXT), `charge_amount` (NUMERIC 12,2), `gateway_latency_ms` (INT), `created_at`.

**GIVEN** `payment_webhook_events` table is created  
**WHEN** a webhook is received  
**THEN** it MUST contain: `id` (UUID, PK), `provider_slug` (TEXT), `event_type` (TEXT), `provider_event_id` (TEXT), `raw_payload` (JSONB), `raw_headers` (JSONB), `state` (TEXT: webhook processing state enum), `retry_count` (SMALLINT, default 0), `next_retry_at` (TIMESTAMPTZ), `processed_at` (TIMESTAMPTZ), `failure_reason` (TEXT), `is_duplicate` (BOOLEAN, default FALSE), `created_at`, `updated_at`; UNIQUE on `(provider_slug, event_type, provider_event_id)`.

**GIVEN** `payment_audit_log` table is created  
**WHEN** an audit entry is inserted  
**THEN** it MUST contain: `id` (UUID, PK), `event_type` (TEXT), `entity_type` (TEXT), `entity_id` (UUID), `service_id` (UUID), `schedule_id` (UUID), `from_state` (TEXT), `to_state` (TEXT), `actor` (TEXT), `actor_id` (UUID), `metadata` (JSONB), `created_at` (TIMESTAMPTZ, set by DB trigger, NOT NULL); the table MUST be INSERT-only via a `SECURITY DEFINER` RPC; direct UPDATE/DELETE MUST be denied.

**GIVEN** `provider_accounts` table is created  
**WHEN** a provider's credentialing data is stored  
**THEN** it MUST contain: `id` (UUID, PK), `provider_user_id` (UUID, FK → `profiles`), `provider_slug` (TEXT), `document` (TEXT, CPF/CNPJ digits only), `netcred_company_id` (TEXT), `netcred_bank_account_id` (TEXT), `onboarding_status` (TEXT, enum), `onboarding_submitted_at` (TIMESTAMPTZ), `onboarding_activated_at` (TIMESTAMPTZ), `created_at`, `updated_at`; UNIQUE on `(provider_user_id, provider_slug)`.

**GIVEN** all payment tables are created  
**WHEN** indexes are defined  
**THEN** required indexes MUST include: `payment_schedules(charge_scheduled_at, state, locked_until)`, `payment_schedules(contracted_service_id)`, `payment_schedules(idempotency_key)` (UNIQUE), `payment_attempts(schedule_id, attempt_number)`, `payment_webhook_events(provider_slug, event_type, provider_event_id)` (UNIQUE), `payment_audit_log(contracted_service_id, created_at)`, `payment_audit_log(schedule_id, created_at)`, `payment_tokens(client_id, state)`, `provider_accounts(provider_user_id, provider_slug)` (UNIQUE).

---

## Requirement 27: Checkout Trust and Security Communication

*User Story*: As a client providing card data, I want to be clearly informed about the payment partner, data security practices, and terms I am accepting so that I can provide genuinely informed consent.

### Acceptance Criteria

**GIVEN** the card input or saved-card selection step is rendered  
**WHEN** the client views the checkout stepper  
**THEN** the UI MUST display a disclosure block stating: (a) transactions are processed by a commercial payment partner, (b) a tappable link labeled "Termos de Uso" that opens the partner's ToS in a browser, (c) that card data is tokenized and not stored in raw form by Renovi, (d) that by confirming, the client accepts the payment partner's terms; this block MUST be visually prominent, not hidden in small print.

**GIVEN** the client taps "Next" past the card step  
**WHEN** the acceptance is processed server-side  
**THEN** `payment_audit_log` MUST record `event_type = 'PAYMENT_TERMS_ACCEPTED'`, `actor = 'client'`, `actor_id = auth.uid()`, `metadata = { provider_slug: 'netcred', timestamp }`.

**GIVEN** the installment selection step is displayed  
**WHEN** all installment options are rendered  
**THEN** for each installment count `n`, the UI MUST show: `{n}x de R$ {installment_amount}` AND `Total com taxas: R$ {total_with_fees}`; a fee disclosure note MUST explain that applicable credit card fees are included in the total.

**GIVEN** the client reaches the final confirmation step before tapping "Confirm"  
**WHEN** the confirmation summary is rendered  
**THEN** the UI MUST disclose when the card will be charged: (a) if `service_scheduled_at - now() >= 48 hours`, display the `charge_scheduled_at` date (48 hours before service); (b) if `service_scheduled_at - now() < 48 hours` (emergency scheduling), display that the charge will occur within the next few hours (no fixed cron time); this disclosure MUST be visible before the client confirms acceptance.

---

## Requirement 28: Saved Card Management (Client Profile)

*User Story*: As a client, I want to view, add, and remove payment methods from my profile screen independently of an active acceptance flow.

### Acceptance Criteria

**GIVEN** a client navigates to the "Meu Perfil" screen  
**WHEN** the payment methods section renders  
**THEN** the UI MUST display all `payment_tokens` records WHERE `client_id = auth.uid()` AND `state = 'ACTIVE'`, showing: masked card number (`•••• XXXX`), card brand icon, expiry month/year, and a "Remove" action.

**GIVEN** a client taps "Adicionar Cartão" from the profile screen  
**WHEN** the add card form is shown  
**THEN** the shared card input component from the `payments` feature MUST be reused; duplicate card form components MUST NOT exist; the same `tokenize-payment-card` Edge Function MUST be called.

**GIVEN** a client attempts to remove a saved card  
**WHEN** the card is linked to a `payment_schedules` record in `SCHEDULED` or `FAILED` state  
**THEN** the UI MUST warn the client that removal will affect a pending service payment; the client MUST be required to assign a replacement card to the affected service before removal is permitted.

**GIVEN** a client removes a card with no active linked schedules  
**WHEN** the removal is confirmed  
**THEN** `payment_tokens.state` MUST be set to `REVOKED`; the card MUST disappear from the profile list; no gateway API call is required for removal (the token remains valid at NetCred but Renovi will not use it for new charges).

---

## Requirement 29: Provider Marketplace Access Gate

*User Story*: As the platform, I want non-credentialed providers to be blocked from the full marketplace — service opportunities, chat initiation, and proposal acceptance — so that no service commitment is made to a provider incapable of receiving payment.

### Acceptance Criteria

**GIVEN** a provider's `onboarding_status ≠ 'ACTIVE'`  
**WHEN** any opportunity-listing RPC is called  
**THEN** the RPC (`match_provider_jobs` and all variants) MUST return an empty result set; this enforcement MUST be in the Postgres RPC (`SECURITY DEFINER`), not only in client-side rendering.

**GIVEN** a provider's `onboarding_status ≠ 'ACTIVE'`  
**WHEN** they attempt to initiate a chat with a client  
**THEN** the chat initiation RPC MUST be denied with `error_code: 'PROVIDER_NOT_CREDENTIALED'`; no chat thread MUST be created; the app MUST display the credentialing progress screen.

**GIVEN** a provider's `onboarding_status ≠ 'ACTIVE'`  
**WHEN** `accept_proposal` is called on their behalf  
**THEN** the RPC MUST return `error_code: 'PROVIDER_NOT_CREDENTIALED'` (HTTP 409); the acceptance MUST NOT proceed.

**GIVEN** a provider transitions to `onboarding_status = 'ACTIVE'` (cron detection)  
**WHEN** the next app session begins  
**THEN** the opportunities list MUST populate; a Push notification MUST be dispatched to the provider confirming successful credentialing and ability to accept service requests.

**GIVEN** a provider is `SUSPENDED`  
**WHEN** they call any opportunity-listing, chat-initiation, or proposal-acceptance RPC  
**THEN** the RPC MUST deny access identically to `PENDING_DOCUMENTS`; a suspension-specific message MUST be shown in the UI with support contact information; existing `CONFIRMED`/`EXECUTED` service chat threads remain accessible.

**GIVEN** a provider transitions from `SUSPENDED` to `ACTIVE` via admin reactivation  
**WHEN** pre-charge services (`PENDING_PAYMENT`) were frozen during suspension  
**THEN** charging MUST NOT automatically resume; ops resolves each frozen service case by case (e.g., cancel, reschedule, or manually trigger charge); the cron MUST continue to skip schedules where provider was suspended until ops explicitly unfreezes or cancels.

---

## Requirement 30: Event-Driven Internal Architecture

*User Story*: As the systems architect, I want payment lifecycle domain events to be published to an internal event log so that downstream consumers (notifications, analytics, audit) can react without coupling to payment internals.

### Acceptance Criteria

**GIVEN** any of the following domain events occurs: `ChargeScheduled`, `ChargeAttemptStarted`, `ChargeSucceeded`, `ChargeFailed`, `ChargePermanentlyFailed`, `ManualPaymentInitiated`, `RefundRequested`, `RefundConfirmed`, `ServiceAutoCancelled`, `ProviderCredentialed`, `WebhookReceived`, `CardTokenized`  
**WHEN** the event is committed to the database  
**THEN** a corresponding INSERT MUST be made to `payment_events` with: `event_type`, `aggregate_type` (`'payment_schedule' | 'payment_token' | 'provider_account'`), `aggregate_id`, `service_id`, `payload` (JSONB), `created_at`.

**GIVEN** the Multichannel Message Dispatcher consumes payment events  
**WHEN** `ChargeSucceeded` or `ChargeFailed` events are available  
**THEN** the dispatcher MUST enqueue the appropriate notification without the payment execution cron coupling directly to the notification API; decoupling MUST allow notifications to fail without affecting charge state.

**GIVEN** the analytics subsystem reads `payment_events`  
**WHEN** aggregate metrics are computed  
**THEN** it MUST be possible to derive: approval rate (PAID / total `ChargeAttemptStarted`), failure rate by error code, mean and P95 gateway latency from `payment_attempts`, refund rate per service category.

---

## Requirement 31: ClearSale Device Fingerprint Integration

*User Story*: As the antifraude integration engineer, I want the ClearSale Behavior Analytics SDK to be initialized at checkout and the resulting `sessionId` persisted through to charge execution so that every `chargeCreate` call carries a valid device fingerprint, satisfying NetCred's ClearSale requirement in production.

### Background

ClearSale is NetCred's antifraude partner. It uses a device fingerprinting script (Browser/WebView SDK) to identify whether a device and its transaction history are known to ClearSale. The system works as follows:

1. The client-side SDK is initialized on the checkout screen with an `AppKey` (identifies the Renovi app) and a `sessionId` (unique per checkout session, UUID format).
2. The SDK collects public device information (IP, hardware/software characteristics, network info) and sends it asynchronously to ClearSale's servers, binding the data to the `sessionId`.
3. When `chargeCreate` is called (at T-2 by the cron), `orderInput.sessionId` must carry the SAME `sessionId` used in step 1 so ClearSale can match the device data to the transaction.
4. Since the cron runs 48 hours after checkout with no user context, the `sessionId` MUST be persisted in `payment_schedules` at acceptance time.

### Acceptance Criteria

**GIVEN** the card step of the checkout stepper is about to render (either new card form or saved card selection)  
**WHEN** the React component mounts  
**THEN** the frontend MUST generate a UUID v4 as `clearsaleSessionId` and store it in the stepper's local state; this value MUST remain stable for the entire checkout session (MUST NOT regenerate on re-renders or step navigation).

**GIVEN** the card step component has mounted and `clearsaleSessionId` is set  
**WHEN** the component runs its initialization effect  
**THEN** the ClearSale Browser/WebView SDK script MUST be injected into the document using the async loader pattern:
```js
(function (a, b, c, d, e, f, g) {
  a['CsdpObject'] = e; a[e] = a[e] || function () {
  (a[e].q = a[e].q || []).push(arguments)
  }, a[e].l = 1 * Date.now(); f = b.createElement(c),
  g = b.getElementsByTagName(c)[0]; f.async = 1; f.src = d; g.parentNode.insertBefore(f, g)
})(window, document, 'script', '//device.clearsale.com.br/p/fp.js', 'csdp');
csdp('app', import.meta.env.VITE_CLEARSALE_APP_KEY);
csdp('sessionid', clearsaleSessionId);
```
The script MUST be loaded asynchronously to avoid blocking card form rendering; if the script load fails (network error), the checkout flow MUST continue and the failure MUST be logged as a `WARN` via the structured logger.

**GIVEN** the ClearSale SDK is running on the Capacitor Android WebView  
**WHEN** the card step renders inside the WebView  
**THEN** the Browser/WebView SDK MUST be used (NOT the React Native SDK); the Capacitor WebView executes standard web JavaScript, so `fp.js` applies identically to both web/PWA and Android deployments.

**GIVEN** the `VITE_CLEARSALE_APP_KEY` environment variable  
**WHEN** the SDK is initialized  
**THEN** the AppKey MUST be read from `VITE_CLEARSALE_APP_KEY` (non-secret, safe to expose in web bundles — it only identifies the application, it does not authenticate it); it MUST NOT be hardcoded in source code; it MUST be set in Supabase project environment and Vite build configuration.

**GIVEN** the client abandons the checkout stepper and returns later  
**WHEN** the card step renders again  
**THEN** a NEW `clearsaleSessionId` MUST be generated; the ClearSale documentation explicitly states that the `sessionId` must be updated whenever the user leaves the checkout and returns, since a new device information capture begins.

**GIVEN** the checkout stepper reaches the confirmation step  
**WHEN** the client taps "Confirm" to submit `accept_proposal`  
**THEN** `clearsale_session_id` (the UUID generated at the card step) MUST be included in the `accept_proposal` Edge Function request payload; the Edge Function MUST persist this value in `payment_schedules.clearsale_session_id`; if absent from the payload, the Edge Function MUST log a `WARN` but MUST NOT reject the acceptance.

**GIVEN** the `accept_proposal` Edge Function processes the request  
**WHEN** it captures the client IP address  
**THEN** the Edge Function MUST extract the client IP from the request's `X-Forwarded-For` header (first value) or `CF-Connecting-IP` header (Cloudflare/Supabase), falling back to the remote address; this IP MUST be persisted in `payment_schedules.client_ip_address` for use in `chargeCreate.customerIpAddress`.

**GIVEN** the T-2 cron executes `chargeCreate` for a payment schedule  
**WHEN** it assembles the `chargeCreate` input payload  
**THEN** it MUST set: `orderInput.sessionId = payment_schedules.clearsale_session_id` (if non-null); `customerIpAddress = payment_schedules.client_ip_address` (if non-null); `orderInput.referenceCode = contracted_service_id` (`contracted_services.id`); if `clearsale_session_id` is NULL, the cron MUST emit a `WARN` Sentry event with `{ schedule_id, reason: 'MISSING_CLEARSALE_SESSION_ID' }` but MUST still attempt the charge (ClearSale coverage is degraded, not blocked).

**GIVEN** the manual payment retry flow (Requirement 13) executes  
**WHEN** the client initiates a manual charge from the service detail screen  
**THEN** the manual payment UI MUST initialize the ClearSale SDK on the payment confirmation screen with a FRESH UUID as the new `clearsaleSessionId`; the `manual-charge-payment` Edge Function MUST update `payment_schedules.clearsale_session_id` and `payment_schedules.client_ip_address` before executing `chargeCreate`, so the manual charge carries a fresh device fingerprint.

**GIVEN** the `chargeCreate` returns `IN_ANALYSIS` due to antifraude review  
**WHEN** the schedule is in `IN_ANALYSIS` state  
**THEN** the `clearsale_session_id` MUST remain in `payment_schedules` for potential reconciliation reference; it MUST NOT be cleared until the schedule reaches a terminal state.

**GIVEN** the `billingAddressInput` is required when ClearSale is active  
**WHEN** `paymentProfileCreate` is called for tokenization  
**THEN** `billingAddressInput` MUST always be included in production; if the billing address was not collected during the checkout stepper, the tokenization MUST fail at the validation layer with an explicit `BILLING_ADDRESS_REQUIRED` error BEFORE calling the gateway; this prevents the `PaymentProfile requires BillingAddress` gateway error.

**GIVEN** ClearSale is configured for the NetCred production company  
**WHEN** the Renovi team sets up the integration  
**THEN** the `VITE_CLEARSALE_APP_KEY` MUST be obtained directly from ClearSale (separate from the NetCred relationship); the AppKey is environment-specific (sandbox AppKey ≠ production AppKey); the team MUST confirm with NetCred/ClearSale whether ClearSale is enabled in sandbox to determine whether `orderInput.sessionId` is required in sandbox `chargeCreate` calls.

---

## Requirement 32: Service Completion Flow (EXECUTED → COMPLETED)

*User Story*: As a service provider, I want to mark a service as executed after I deliver it, and as a client I want to confirm the service was completed, so that both parties have a clear record of service delivery.

### Acceptance Criteria

**GIVEN** `contracted_services.status = 'CONFIRMED'` and `payment_schedules.state = 'PAID'`  
**WHEN** the provider marks the service as executed  
**THEN** the system MUST verify `scheduled_date::date <= CURRENT_DATE` (date-only comparison, no time component); if the scheduled date is in the future, the RPC MUST return HTTP 409 with `error_code: 'SERVICE_NOT_YET_DUE'`; if eligible, the system MUST atomically: (1) transition `contracted_services.status = 'EXECUTED'`, `executed_at = now()`; (2) insert a `payment_audit_log` entry for `event_type = 'SERVICE_EXECUTED'`, `actor = 'provider'`; (3) enqueue a Push notification to the client requesting confirmation ("Confirmar recebimento do serviço").

**GIVEN** `contracted_services.status = 'EXECUTED'`  
**WHEN** the client explicitly confirms service delivery  
**THEN** the system MUST atomically: (1) transition `contracted_services.status = 'COMPLETED'`, `completed_at = now()`, `completed_by = 'client'`; (2) insert a `payment_audit_log` entry for `event_type = 'SERVICE_COMPLETED'`; (3) enqueue a Push notification to the provider confirming completion.

**GIVEN** `contracted_services.status = 'EXECUTED'` AND `executed_at + interval '24 hours' <= now()`  
**WHEN** the `auto-complete-executed-services` cron fires  
**THEN** the system MUST atomically: (1) transition `contracted_services.status = 'COMPLETED'`, `completed_at = now()`, `completed_by = 'system'`; (2) insert a `payment_audit_log` entry for `event_type = 'SERVICE_AUTO_COMPLETED'`; (3) enqueue a Push notification to the client informing them the service was automatically confirmed.

**GIVEN** `contracted_services.status = 'EXECUTED'`  
**WHEN** `payment_schedules.is_disputed = true` (chargeback in progress)  
**THEN** the service status MUST NOT be blocked by the dispute; transition to `COMPLETED` proceeds normally via client confirmation or auto-completion; dispute resolution is handled separately by ops.

**GIVEN** the provider tries to mark a service as executed  
**WHEN** `contracted_services.status ≠ 'CONFIRMED'`  
**THEN** the RPC MUST return HTTP 409 with `error_code: 'INVALID_STATUS_TRANSITION'`; the operation MUST NOT proceed.

---

## Requirement 33: Pre-Charge Client Notification

*User Story*: As a client who accepted a service days before the charge, I want to be reminded 24 hours before my card is charged so that I can update my payment method or cancel if needed.

### Acceptance Criteria

**GIVEN** the `notify-upcoming-charges` cron fires (minimum 4×/day, offset from charge cron)  
**WHEN** it selects eligible schedules  
**THEN** it MUST select `payment_schedules` WHERE `state = 'SCHEDULED'` AND `upcoming_charge_notified_at IS NULL` AND `charge_scheduled_at - now() <= interval '24 hours'` AND `charge_scheduled_at > now()` AND associated `contracted_services.status = 'PENDING_PAYMENT'` AND service is not cancelled.

**GIVEN** an eligible schedule is selected  
**WHEN** notification is dispatched  
**THEN** the system MUST enqueue Push + Email to the client with: service summary, `charge_scheduled_at` date/time, amount to be charged (fee-inclusive), and links to update payment method or cancel; provider MUST NOT be notified about the client's upcoming card charge.

**GIVEN** notification is successfully enqueued  
**WHEN** the cron commits  
**THEN** `payment_schedules.upcoming_charge_notified_at` MUST be set to `now()` atomically in the same transaction; duplicate notifications for the same schedule MUST be prevented by this field.

**GIVEN** `service_scheduled_at - now() < 48 hours` at acceptance (emergency scheduling)  
**WHEN** the pre-charge notification cron evaluates the schedule  
**THEN** the 24h-before-charge notification MUST NOT be sent (charge occurs within hours; checkout disclosure at acceptance is sufficient).

**GIVEN** a service is rescheduled and `charge_scheduled_at` changes  
**WHEN** `CHARGE_RESCHEDULED` is committed  
**THEN** `upcoming_charge_notified_at` MUST be reset to NULL so a new 24h notification can fire for the updated charge date.

**GIVEN** the client updates their payment method before charge  
**WHEN** the update is persisted on a `SCHEDULED` schedule  
**THEN** `upcoming_charge_notified_at` MUST NOT be reset; the existing notification remains valid.

---

# Implementation Guidance

## Architectural Decision: Separation of Concerns

The payment system follows the Orbit platform's established layered architecture:

- **PostgreSQL**: authoritative state, concurrency control, audit, fee calculation.
- **Edge Functions (Deno)**: I/O connectors for gateway calls, tokenization, and webhook ingestion. MUST be stateless.
- **Application Layer (`src/features/payments/`)**: `PaymentProvider` interface, adapters, React UI components, hooks, and feature API layer.
- **Message Dispatcher**: notifications are enqueued, never directly invoked from charge execution paths.

---

## What belongs in PostgreSQL

| Responsibility | Location |
|---|---|
| Payment schedule state (source of truth) | Table `payment_schedules` |
| Charge attempt history | Table `payment_attempts` |
| Webhook event log and deduplication | Table `payment_webhook_events` |
| Audit log (immutable, INSERT-only) | Table `payment_audit_log` |
| Provider credentialing state | Table `provider_accounts` |
| Card token metadata (non-sensitive references) | Table `payment_tokens` |
| Fee rate and limit configuration | Table `platform_constants` |
| Domain event log | Table `payment_events` |
| Gateway JWT token cache | Table `payment_provider_tokens` |
| Webhook processing queue | Table `payment_webhook_processing_queue` |
| Fee and charge amount computation | RPC `calculate_charge_amount(payment_token_id, base_amount, installment_number)` |
| State machine transition enforcement | CHECK constraints + AFTER UPDATE triggers |
| Row-level lease acquisition (dequeue) | `SELECT … FOR UPDATE SKIP LOCKED` inside RPCs |
| Orphaned lease recovery | RPC `recover_orphaned_payment_schedules()` invoked via `pg_cron` |
| Cron scheduling | `pg_cron` extension + Supabase Scheduled Functions |
| Idempotency constraint for schedule creation | UNIQUE constraint on `payment_schedules.idempotency_key` |
| Webhook deduplication constraint | UNIQUE constraint on `(provider_slug, event_type, provider_event_id)` |
| RLS enforcement for client token access | RLS policies on `payment_tokens` |

---

## What belongs in the Application Layer

| Responsibility | Location |
|---|---|
| `PaymentProvider` interface | `src/features/payments/types/payment-provider.interface.ts` |
| `NetCredAdapter` | `src/features/payments/adapters/netcred/` |
| Future provider adapters | `src/features/payments/adapters/<provider-slug>/` |
| Checkout stepper (CPF → Phone → Card → Installments → Confirm) | `src/features/payments/components/checkout-stepper/` |
| Saved card management component | `src/features/payments/components/saved-cards/` |
| Trust disclosure component | `src/features/payments/components/payment-trust-disclosure.tsx` |
| Installment display component | `src/features/payments/components/installment-selector.tsx` |
| Payment feature hooks | `src/features/payments/hooks/` |
| Zod schemas for payment domain types | `src/features/payments/types/` |
| Payment feature API layer (Edge Function callers) | `src/features/payments/api/` |
| Payment feature public API | `src/features/payments/index.ts` |
| Manual payment recovery UI (service detail integration) | Consumed via `src/features/payments/index.ts` |

---

## What belongs in Edge Functions / Workers

| Responsibility | Location |
|---|---|
| Card tokenization (calls `paymentProfileCreate`) | `supabase/functions/tokenize-payment-card/` |
| Installment calculation + HMAC signing | `supabase/functions/calculate-installment-options/` |
| Scheduled charge execution cron (T-2) | `supabase/functions/schedule-netcred-charges/` |
| Manual charge execution (client-triggered) | `supabase/functions/manual-charge-payment/` |
| Webhook ingestion, signature validation, routing | `supabase/functions/netcred-webhook/` |
| Webhook retry worker | `supabase/functions/process-webhook-retry/` |
| Refund processing | `supabase/functions/process-refund/` |
| Provider onboarding detection cron (batch `companies` query) | `supabase/functions/detect-netcred-onboarding/` |
| Auto-cancellation at T-12h | `supabase/functions/auto-cancel-unpaid-services/` |
| Pre-charge client notification (24h before `charge_scheduled_at`) | `supabase/functions/notify-upcoming-charges/` |
| Reconciliation polling (webhook fallback) | `supabase/functions/reconcile-netcred-payments/` |
| Orphaned lease janitor invocation | RPC called directly via `pg_cron` OR `supabase/functions/recover-payment-leases/` |
| KYC email dispatch | `supabase/functions/dispatch-kyc-email/` |
| Shared `NetCredAdapter` and `PaymentProvider` utilities | `supabase/functions/_shared/payment/` |
| NetCred JWT token refresh (shared adapter concern) | `supabase/functions/_shared/payment/netcred-auth.ts` |
| ClearSale `sessionId` + client IP capture and persistence at acceptance | Within `accept_proposal` Edge Function; values passed in request body from the frontend |
| `orderInput.sessionId` and `customerIpAddress` injection into `chargeCreate` | Within `schedule-netcred-charges` and `manual-charge-payment`; read from `payment_schedules` columns |

---

## What belongs in the Frontend (Client Side Only)

| Responsibility | Location |
|---|---|
| ClearSale SDK script injection (`fp.js`) | Checkout stepper card step component (`src/features/payments/components/`) |
| `clearsaleSessionId` UUID generation (`crypto.randomUUID()`) | Checkout stepper state; generated fresh on every card step mount |
| ClearSale SDK re-initialization on checkout re-entry | Card step component — new UUID generated on every mount |
| ClearSale SDK initialization on manual payment retry screen | Manual payment component; fresh UUID per retry session |
| `VITE_CLEARSALE_APP_KEY` consumption | Vite env variable; safe to expose in browser bundle (non-secret) |

---

## Summary: What MUST be transactional vs. asynchronous

| Operation | Execution Model | Rationale |
|---|---|---|
| Lease acquisition + state → `PROCESSING` | Synchronous, single DB transaction | Prevents concurrent workers from processing the same record |
| Final state commit (PAID/FAILED) + audit log | Synchronous, single DB transaction | Atomicity: state and audit MUST always be consistent |
| Notification enqueueing | Asynchronous (enqueue to dispatcher) | Notification failure MUST NOT revert payment state |
| Webhook event persistence | Synchronous, before validation | Events MUST be logged even if processing fails |
| Webhook state reconciliation | Synchronous, single DB transaction | State + audit MUST commit atomically |
| `transactionRefund` submission | Synchronous, sets `REFUND_REQUESTED` | State updated immediately; confirmation is async via webhook |
| KYC email dispatch | Asynchronous (retried via job queue) | Email failure MUST NOT block service acceptance |
| Provider credentialing detection | Asynchronous (cron, 1× daily) | Detection inherently delayed; no blocking path |
| Installment recalculation at charge time | Synchronous, within cron transaction | Fee amount MUST be accurate at charge time |

---

| Service completion (EXECUTED → COMPLETED) | Synchronous, single DB transaction | Status + audit MUST commit atomically |
| Auto-completion cron (24h after EXECUTED) | Asynchronous (cron) | Client inaction must not block finalization indefinitely |

---

*Document prepared 2026-06-24. Synchronized with `CONTEXT.md` decisions #1–38 on 2026-06-24. Must be updated when: (a) a new payment provider adapter is introduced, (b) new payment methods (Pix, Boleto) are activated, (c) Terms of Service §2.2 cancellation penalties are revised, (d) `platform_constants` fee schema is extended, or (e) the NetCred webhook catalog is expanded.*
