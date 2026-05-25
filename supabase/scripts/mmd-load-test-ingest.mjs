#!/usr/bin/env node
/**
 * MMD ingest load test (design §9.1, task 105).
 * Sustained service_role RPC calls to message_dispatcher_ingest.
 *
 * Usage:
 *   nvm use 24.13
 *   export SUPABASE_URL=http://127.0.0.1:54321
 *   export SUPABASE_SERVICE_ROLE_KEY=<service_role>
 *   export MMD_LOAD_TEST_PROFILE_ID=<uuid>
 *   node supabase/scripts/mmd-load-test-ingest.mjs
 *   node supabase/scripts/mmd-load-test-ingest.mjs --rps 50 --duration 300 --channel email
 *   node supabase/scripts/mmd-load-test-ingest.mjs --smoke
 */

import { randomUUID } from "node:crypto";

const DEFAULT_RPS = 50;
const DEFAULT_DURATION_SEC = 300;
const DEFAULT_CHANNEL = "email";
const DEFAULT_TEMPLATE = "welcome_template";

function parseArgs(argv) {
  const opts = {
    rps: DEFAULT_RPS,
    durationSec: DEFAULT_DURATION_SEC,
    channel: DEFAULT_CHANNEL,
    templateKey: DEFAULT_TEMPLATE,
    smoke: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--smoke") {
      opts.smoke = true;
      opts.rps = 10;
      opts.durationSec = 2;
    } else if (arg === "--rps" && argv[i + 1]) {
      opts.rps = Number(argv[++i]);
    } else if (arg === "--duration" && argv[i + 1]) {
      opts.durationSec = Number(argv[++i]);
    } else if (arg === "--channel" && argv[i + 1]) {
      opts.channel = argv[++i];
    } else if (arg === "--template" && argv[i + 1]) {
      opts.templateKey = argv[++i];
    }
  }

  return opts;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function ingestOnce({ url, serviceKey, profileId, channel, templateKey }) {
  const started = performance.now();
  const res = await fetch(`${url}/rest/v1/rpc/message_dispatcher_ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Accept-Profile": "message_dispatcher",
      "Content-Profile": "message_dispatcher",
    },
    body: JSON.stringify({
      p_idempotency_key: randomUUID(),
      p_profile_id: profileId,
      p_channel: channel,
      p_template_key: templateKey,
      p_template_variables: { name: "load-test" },
      p_source_system: "mmd_load_test",
    }),
  });

  const latencyMs = performance.now() - started;
  const body = await res.text();

  return {
    ok: res.ok,
    status: res.status,
    latencyMs,
    body,
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const profileId = process.env.MMD_LOAD_TEST_PROFILE_ID;

  if (!url || !serviceKey || !profileId) {
    console.error(
      "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or MMD_LOAD_TEST_PROFILE_ID",
    );
    process.exit(1);
  }

  const intervalMs = 1000 / opts.rps;
  const endAt = Date.now() + opts.durationSec * 1000;
  const latencies = [];
  let success = 0;
  let failed = 0;

  console.log(
    JSON.stringify({
      event: "mmd_load_test_start",
      rps: opts.rps,
      duration_sec: opts.durationSec,
      channel: opts.channel,
      smoke: opts.smoke,
    }),
  );

  while (Date.now() < endAt) {
    const tickStart = Date.now();
    const result = await ingestOnce({
      url: url.replace(/\/$/, ""),
      serviceKey,
      profileId,
      channel: opts.channel,
      templateKey: opts.templateKey,
    });

    latencies.push(result.latencyMs);
    if (result.ok) success += 1;
    else failed += 1;

    const elapsed = Date.now() - tickStart;
    const sleepMs = Math.max(0, intervalMs - elapsed);
    if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));
  }

  latencies.sort((a, b) => a - b);
  const total = success + failed;
  const errorRate = total === 0 ? 1 : failed / total;

  const summary = {
    event: "mmd_load_test_complete",
    total,
    success,
    failed,
    error_rate: Number(errorRate.toFixed(4)),
    latency_ms: {
      p50: Math.round(percentile(latencies, 50)),
      p95: Math.round(percentile(latencies, 95)),
      max: Math.round(latencies[latencies.length - 1] ?? 0),
    },
  };

  console.log(JSON.stringify(summary));

  const maxErrorRate = opts.smoke ? 0.2 : 0.01;
  if (errorRate > maxErrorRate) {
    console.error(`Error rate ${errorRate} exceeds threshold ${maxErrorRate}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
