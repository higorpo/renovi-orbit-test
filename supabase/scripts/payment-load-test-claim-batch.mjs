#!/usr/bin/env node
/**
 * Payment claim batch load test (Task 99).
 * Simulates parallel cron workers calling payment_claim_charge_batch(10).
 *
 * Usage:
 *   nvm use 24.13
 *   export SUPABASE_URL=http://127.0.0.1:54321
 *   export SUPABASE_SERVICE_ROLE_KEY=<service_role>
 *   psql "$DATABASE_URL" -f supabase/scripts/payment-load-test-claim-batch.seed.sql
 *   node supabase/scripts/payment-load-test-claim-batch.mjs
 *   node supabase/scripts/payment-load-test-claim-batch.mjs --workers 4 --batch-size 10 --smoke
 */

const DEFAULT_WORKERS = 4;
const DEFAULT_BATCH_SIZE = 10;

function parseArgs(argv) {
  const opts = {
    workers: DEFAULT_WORKERS,
    batchSize: DEFAULT_BATCH_SIZE,
    smoke: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--smoke") {
      opts.smoke = true;
      opts.workers = 2;
      opts.batchSize = 10;
    } else if (arg === "--workers" && argv[i + 1]) {
      opts.workers = Number(argv[++i]);
    } else if (arg === "--batch-size" && argv[i + 1]) {
      opts.batchSize = Number(argv[++i]);
    }
  }

  return opts;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function claimBatchOnce({ url, serviceKey, batchSize }) {
  const started = performance.now();
  const res = await fetch(`${url}/rest/v1/rpc/payment_claim_charge_batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ p_batch_size: batchSize }),
  });

  const latencyMs = performance.now() - started;
  const bodyText = await res.text();
  let payload = null;

  try {
    payload = JSON.parse(bodyText);
  } catch {
    payload = bodyText;
  }

  return {
    ok: res.ok,
    status: res.status,
    latencyMs,
    payload,
    claimedCount: Array.isArray(payload) ? payload.length : 0,
    claimedIds: Array.isArray(payload)
      ? payload.map((row) => row?.id).filter(Boolean)
      : [],
  };
}

async function countProcessingLoadTestSchedules({ url, serviceKey }) {
  const res = await fetch(
    `${url}/rest/v1/payment_schedules?select=id&state=eq.PROCESSING&idempotency_key=like.load-test-claim-batch-*`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "count=exact",
      },
    },
  );

  const range = res.headers.get("content-range") ?? "";
  const match = range.match(/\/(\d+)$/);
  const count = match ? Number(match[1]) : null;

  return {
    ok: res.ok,
    status: res.status,
    processingCount: count,
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      event: "payment_claim_batch_load_test_start",
      workers: opts.workers,
      batch_size: opts.batchSize,
      smoke: opts.smoke,
    }),
  );

  const workerResults = await Promise.all(
    Array.from({ length: opts.workers }, (_, workerIndex) =>
      claimBatchOnce({ url, serviceKey, batchSize: opts.batchSize }).then((result) => ({
        workerIndex,
        ...result,
      }))
    ),
  );

  const latencies = workerResults.map((result) => result.latencyMs).sort((a, b) => a - b);
  const allClaimedIds = workerResults.flatMap((result) => result.claimedIds);
  const uniqueClaimedIds = new Set(allClaimedIds);
  const duplicateLeaseCount = allClaimedIds.length - uniqueClaimedIds.size;
  const failedWorkers = workerResults.filter((result) => !result.ok).length;
  const totalClaimed = workerResults.reduce((sum, result) => sum + result.claimedCount, 0);

  const processingSnapshot = await countProcessingLoadTestSchedules({ url, serviceKey });

  const summary = {
    event: "payment_claim_batch_load_test_complete",
    workers: opts.workers,
    batch_size: opts.batchSize,
    smoke: opts.smoke,
    total_claimed: totalClaimed,
    unique_schedule_ids: uniqueClaimedIds.size,
    duplicate_lease_count: duplicateLeaseCount,
    failed_workers: failedWorkers,
    processing_count: processingSnapshot.processingCount,
    latency_ms: {
      p50: Math.round(percentile(latencies, 50)),
      p95: Math.round(percentile(latencies, 95)),
      max: Math.round(latencies.at(-1) ?? 0),
    },
    worker_results: workerResults.map(({ workerIndex, ok, status, claimedCount, latencyMs }) => ({
      worker_index: workerIndex,
      ok,
      status,
      claimed_count: claimedCount,
      latency_ms: Math.round(latencyMs),
    })),
  };

  console.log(JSON.stringify(summary));

  if (failedWorkers > 0 || duplicateLeaseCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
