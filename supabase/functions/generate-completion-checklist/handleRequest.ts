/** HTTP handler — cron/internal secret auth (design §5.2 / Tasks 29/64 pacing). */

import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { validateOrbitCronAuth } from "../_shared/security/orbit-cron-auth.ts";
import { DEFAULT_BATCH_SIZE } from "./constants.ts";
import { resolveClaimBatchSize, resolveMaxLlmCallsPerInvocation } from "./pacing.ts";
import { processClaimedRow } from "./processClaimedRow.ts";
import type {
  GenerateCompletionChecklistDeps,
  WorkerRunSummary,
} from "./types.ts";

export async function handleGenerateCompletionChecklistRequest(
  req: Request,
  deps: GenerateCompletionChecklistDeps,
): Promise<Response> {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  const auth = validateOrbitCronAuth(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.code }, auth.status, cors);
  }

  const leaseTtlSeconds = deps.getLeaseTtlSeconds
    ? await deps.getLeaseTtlSeconds()
    : 120;
  const leaseTtlMs = Math.max(1, leaseTtlSeconds) * 1_000;

  let requestedBatch = deps.getClaimBatchSizeDefault
    ? await deps.getClaimBatchSizeDefault()
    : deps.batchSize;
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await req.json() as { batch_size?: number };
      if (
        typeof body.batch_size === "number" &&
        Number.isInteger(body.batch_size) &&
        body.batch_size > 0 &&
        body.batch_size <= 50
      ) {
        requestedBatch = body.batch_size;
      }
    } catch {
      // Empty body is fine for cron wake.
    }
  }

  // Cap claim so excess due PENDING remain for next wake/cron (Tasks 29/64).
  const batchSize = resolveClaimBatchSize(requestedBatch, Deno.env, leaseTtlMs);
  const maxLlm = resolveMaxLlmCallsPerInvocation(Deno.env, undefined, leaseTtlMs);

  const leaseOwner = deps.createLeaseOwner();
  const claimed = await deps.claimBatch(leaseOwner, batchSize);

  const summary: WorkerRunSummary = {
    claimed: claimed.length,
    ready_ai: 0,
    ready_fallback: 0,
    retry_scheduled: 0,
    ops_attention: 0,
    noop: 0,
    errors: 0,
  };

  // Serial LLM (max concurrent = 1); claimed length already ≤ maxLlm.
  for (const row of claimed) {
    try {
      const outcome = await processClaimedRow(row, deps);
      switch (outcome.kind) {
        case "ready_ai":
          summary.ready_ai += 1;
          break;
        case "ready_fallback":
          summary.ready_fallback += 1;
          break;
        case "retry_scheduled":
          summary.retry_scheduled += 1;
          break;
        case "ops_attention":
          summary.ops_attention += 1;
          break;
        case "noop":
          summary.noop += 1;
          break;
        case "error":
          summary.errors += 1;
          console.error(
            JSON.stringify({
              event: "enrichment_row_error",
              service_request_id: row.service_request_id,
              enrichment_id: row.id,
              attempt_count: row.attempt_count,
              lease_generation: row.lease_generation,
              correlation_id: row.correlation_id,
              reason: outcome.reason,
            }),
          );
          break;
      }
    } catch (error) {
      summary.errors += 1;
      console.error(
        JSON.stringify({
          event: "enrichment_row_exception",
          service_request_id: row.service_request_id,
          enrichment_id: row.id,
          attempt_count: row.attempt_count,
          lease_generation: row.lease_generation,
          correlation_id: row.correlation_id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return jsonResponse(
    {
      ok: true,
      lease_owner: leaseOwner,
      batch_size: batchSize || DEFAULT_BATCH_SIZE,
      requested_batch_size: requestedBatch,
      lease_ttl_seconds: leaseTtlSeconds,
      max_llm_per_invocation: maxLlm,
      llm_concurrency: 1,
      ...summary,
    },
    200,
    cors,
  );
}
