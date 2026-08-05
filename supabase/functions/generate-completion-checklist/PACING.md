# Enrichment worker pacing (Tasks 29 / 64)

`generate-completion-checklist` claims a **bounded** batch, runs **serial** LLM calls (concurrency = 1), and leaves excess due rows `PENDING` for the next wake/cron tick.

## Platform defaults (DB — authoritative, read dynamically)

| `platform_constants` key | Default | Consumer |
|---|---|---|
| `enrichment_claim_batch_size` | **20** | Worker `getClaimBatchSizeDefault`; RPC default when `p_batch_size` null |
| `enrichment_lease_ttl_seconds` | **120** | `enrichment_claim_batch` lease; worker timeout math |
| `enrichment_retry_base_seconds` | **30** | `enrichment_schedule_retry` only (`base * 2^attempt` + jitter) |
| `checklist_ai_max_attempts` | **3** | Worker `getMaxAttempts` before template fallback |

Tune in DB without redeploying Edge; worker re-reads each invocation.

## Edge env overrides

| Constant / env | Default | Role |
|---|---|---|
| `ENRICHMENT_LLM_TIMEOUT_MS` | 75000 | Gemini HTTP abort; hard-capped to lease − 30s margin |
| `ENRICHMENT_MAX_LLM_PER_INVOCATION` | 1 | Max claim+LLM rows per invocation; further capped by `floor(safeTimeout / timeout)` (≤ 5) |
| `ENRICHMENT_MAX_CONTEXT_CHARS` | 12000 | Truncate intake JSON before LLM; structured log on truncate |
| `GEMINI_API_KEY` | — | Required for AI path (shared with `generate-smart-description`) |
| `GEMINI_CHECKLIST_MODEL` | `gemini-2.5-flash-lite` | Optional override |

## Load assumptions (Task 64)

| Assumption | Bound |
|---|---|
| Edge function wall clock | Must finish LLM + finalize **inside** lease (120s); timeout ≤ 90s safe budget |
| LLM provider quota | Serial calls; default **1** LLM/tick avoids thundering herd across replicas |
| PENDING backlog of N | Claim size = `min(requested, max_llm)`; unclaimed stay PENDING for cron/wake |
| Cron / wake overlap | `SKIP LOCKED` + lease generation CAS — safe multi-replica |

## Error classes

| Class | Examples | Worker action |
|---|---|---|
| `transient` | `LLM_TIMEOUT`, 429/5xx, network | `enrichment_schedule_retry` |
| `validation` | `LLM_SCHEMA_*`, `LLM_JSON_PARSE` | retry then template fallback |
| `fatal` | missing API key, other 4xx | fallback / ops_attention (no endless retry) |

## Backpressure

Claim size = `min(platform_or_body_batch, max_llm_per_invocation)`. Unclaimed due PENDING rows are picked up by enqueue wake or `enrichment_cron_sweep`.
