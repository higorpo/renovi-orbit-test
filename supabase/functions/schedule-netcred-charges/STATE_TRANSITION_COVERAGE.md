# Charge Cron — State Transition Coverage Report

**Task:** 77  
**Date:** 2026-06-24  
**Test file:** `integration.test.ts`  
**Harness:** `integrationStateHarness.ts`  
**Mock gateway:** `mockNetcredServer.ts`

## Coverage matrix

| Path | States | Verified by | Audit | Attempts | Events |
|------|--------|-------------|-------|----------|--------|
| Cron success | `SCHEDULED` → `PROCESSING` → `PAID` | `integration: SCHEDULED → PROCESSING → PAID` | CHARGE_ATTEMPT_STARTED, CHARGE_PAID | 1 row | ChargeSucceeded |
| Webhook capture | `SCHEDULED` → `PROCESSING` → `IN_ANALYSIS` → `PAID` | `integration: … IN_ANALYSIS → PAID via webhook` | + WEBHOOK_CAPTURE | 1 row (cron) | ChargeInAnalysis + ChargeSucceeded |
| Retry exhaustion | `SCHEDULED` → `PROCESSING` → `FAILED` ×2 → `FAILED_PERMANENT` | `integration: retryable FAILED → … max attempts` | CHARGE_FAILED ×2, CHARGE_FAILED_PERMANENT | 3 rows | ChargeFailed + ChargePermanentlyFailed |
| Terminal first attempt | `SCHEDULED` → `PROCESSING` → `FAILED_PERMANENT` (undo increment) | `integration: terminal error → FAILED_PERMANENT` | CHARGE_FAILED_PERMANENT | 1 row | ChargePermanentlyFailed |
| Emergency scheduling | `charge_scheduled_at = now()` | `integration: emergency scheduling` | EMERGENCY_SCHEDULING | — | — |
| Auto-cancel T-12h | `FAILED_PERMANENT` → service `CANCELLED` | `integration: auto_cancel_services at T-12h` | SERVICE_AUTO_CANCELLED | — | — |
| Mock NetCred HTTP | GraphQL `chargeCreate` | `integration: mock NetCred HTTP server` | — | — | — |
| Transition artifacts | All cron commits | `integration: audit log and payment_events` | ≥2 entries | ≥1 | ≥1 |

## Acceptance criteria mapping

| Criterion | Coverage |
|-----------|----------|
| 10A.1–10A.9 (charge execution) | Cron PAID, IN_ANALYSIS, FAILED, FAILED_PERMANENT paths |
| 11A.1–11A.7 (retry/backoff) | 3-attempt retry exhaustion + terminal undo increment |
| 14A.1–14A.7 (auto-cancel) | T-12h cancel after FAILED_PERMANENT |

## Gaps / follow-ups

- **Task 78:** concurrent dequeue SKIP LOCKED (pgTAP + parallel clients).
- **Task 79:** webhook dedup and out-of-order delivery (netcred-webhook tests).
- **Production parity:** harness mirrors RPC semantics; pgTAP remains authoritative for SQL triggers.

## Run

```bash
yarn test:deno -- supabase/functions/schedule-netcred-charges/integration.test.ts
```
