# MMD load test — ingest 50 RPS (MVP)

Validates design §9.1 MVP target: **50 sustained ingest RPS** for 5 minutes via `message_dispatcher_ingest` (`service_role`).

## Prerequisites

- Staging or local Supabase with MMD migrations applied
- Dedicated test `profile_id` (not production users)
- `message_dispatcher` schema exposed in PostgREST (`config.toml` `[api].schemas`)

## Run (full soak)

```bash
nvm use 24.13
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role>"
export MMD_LOAD_TEST_PROFILE_ID="<uuid>"

node supabase/scripts/mmd-load-test-ingest.mjs --rps 50 --duration 300 --channel email
```

## Smoke (CI / pre-flight, ~2s)

```bash
node supabase/scripts/mmd-load-test-ingest.mjs --smoke
```

## Success criteria

| Metric | Threshold |
|--------|-----------|
| Duration | 300s (5 min) at `--rps 50` |
| Error rate | < 1% non-2xx RPC responses |
| Latency p95 | Track in output; investigate if > 500ms sustained |

## What to watch

- `user_limits` row lock contention (design §9.2) — per-profile ingest serializes
- Connection pool saturation on Supabase
- `message_dispatches` insert rate vs audit trigger overhead

## Output

Script prints JSON lines `mmd_load_test_start` and `mmd_load_test_complete` with `error_rate` and latency percentiles.

## Related

- Script: `supabase/scripts/mmd-load-test-ingest.mjs`
- Self-check: `supabase/scripts/mmd-load-test-ingest.selfcheck.mjs`
