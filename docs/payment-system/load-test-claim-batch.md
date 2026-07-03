# Payment load test — `payment_claim_charge_batch` at batch_size 10 (Task 99)

Validates lock contention under parallel cron workers on staging (or local Supabase). Each worker invokes `payment_claim_charge_batch(10)` once, simulating overlapping `schedule-netcred-charges` cron ticks.

## Prerequisites

- Staging or local Supabase with payment migrations applied
- `service_role` key (never run against production without isolated fixtures)
- Seed SQL creates 30 tagged `SCHEDULED` rows (`idempotency_key` prefix `load-test-claim-batch-`)

## Run

```bash
nvm use 24.13
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role>"
export DATABASE_URL="postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/scripts/payment-load-test-claim-batch.seed.sql
node supabase/scripts/payment-load-test-claim-batch.mjs --workers 4 --batch-size 10
```

## Smoke (local pre-flight)

```bash
yarn db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/scripts/payment-load-test-claim-batch.seed.sql
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY=<local service_role>
node supabase/scripts/payment-load-test-claim-batch.mjs --smoke
```

## Success criteria

| Metric | Threshold |
|--------|-----------|
| `duplicate_lease_count` | **0** — no schedule claimed by more than one worker |
| `failed_workers` | **0** — all RPC calls return 2xx |
| `total_claimed` | ≤ `workers × batch_size` and ≤ seeded eligible count (30) |
| Latency p95 | Track in output; investigate if > 500ms sustained on staging |

## What to watch

- `SKIP LOCKED` behavior when workers overlap — total unique leases must equal total claimed rows
- Connection pool saturation on Supabase PostgREST
- Leftover `PROCESSING` rows after aborted runs — expire leases or run orphan janitor before re-seeding

## Cleanup

```sql
delete from public.payment_schedules
where idempotency_key like 'load-test-claim-batch-%';
```

## CI regression (pgTAP)

Deterministic batch-size coverage without parallel sessions:

```bash
npx supabase test db --local supabase/tests/payments/payment_claim_charge_batch_load_test.sql
```

## Related

- Script: `supabase/scripts/payment-load-test-claim-batch.mjs`
- Seed: `supabase/scripts/payment-load-test-claim-batch.seed.sql`
- pgTAP: `supabase/tests/payments/payment_claim_charge_batch_load_test.sql`
- Parallel session pgTAP (Task 116): future two-session SKIP LOCKED test
