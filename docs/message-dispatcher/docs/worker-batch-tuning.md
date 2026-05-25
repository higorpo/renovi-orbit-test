# MMD worker batch and wall-clock tuning

Operational targets from design §5.5 and §9.1 (task 107).

## Checkout batch size

| Parameter | Value | Where |
|-----------|-------|-------|
| Default `p_limit` | **25** | `platform_constants.message_dispatcher.checkout_batch_size`, Edge `DEFAULT_CHECKOUT_LIMIT` |
| Max `p_limit` | **50** | RPC `message_dispatcher_checkout_batch` raises `22023` above 50 |
| Min `p_limit` | **1** | RPC validation |

Rationale: 25 items × ~2s provider HTTP (25s timeout cap) fits inside a **60s** worker budget with render/report overhead.

## Wall-clock budget

| Target | ms | Enforcement |
|--------|-----|-------------|
| p95 goal | **60,000** | `WORKER_WALL_CLOCK_BUDGET_MS` — stop processing new batch items when exceeded |
| Hard limit | **120,000** | Edge/platform ceiling (design §5.5); do not configure cron timeout below this |

Worker response includes `wall_clock_ms`, optional `skipped`, and `budget_exceeded` when the batch is truncated.

## Provider HTTP vs lease

| Constant | Value | Notes |
|----------|-------|-------|
| `PROVIDER_HTTP_TIMEOUT_MS` | 25,000 | Must finish before 30s lease reclaim |
| `DISPATCH_LEASE_SECONDS` | 30 | DB `platform_constants.message_dispatcher.lease_seconds` |

## Tuning checklist

- [ ] Keep `p_limit` at 25 unless profiling shows headroom under 60s p95.
- [ ] Never raise `p_limit` above 50 without load test on staging.
- [ ] Monitor `worker.batch_budget_exceeded` logs and `wall_clock_ms` in worker responses.
- [ ] If p95 > 60s, reduce batch size or optimize template render — not cron interval alone.

## Related

- `supabase/functions/message-dispatcher-worker/constants.ts`
- `supabase/functions/message-dispatcher-worker/workerBudget.ts`
- `load-test-ingest-50-rps.md`
