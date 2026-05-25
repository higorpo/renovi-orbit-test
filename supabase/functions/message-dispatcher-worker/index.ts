/**
 * Edge Function: message-dispatcher-worker (design §5.5).
 *
 * Stateless worker with re-checkout loop: drains QUEUED items until the
 * wall-clock budget is exhausted or the queue is empty.
 */

import "xhr";
import { serve } from "std/http/server";
import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createLogger } from "../_shared/logger.ts";
import { initSentryEdge, withSpan } from "../_shared/sentrySpans.ts";
import { validateWorkerAuth } from "./auth.ts";
import { checkoutBatch } from "./checkout.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import { processCheckoutItemsSequential } from "./processDispatch.ts";
import {
  createWorkerWallClockBudget,
  isWorkerWallClockExceeded,
  workerWallClockElapsedMs,
} from "./workerBudget.ts";
import type { WorkerRunResult } from "./types.ts";

const log = createLogger("message-dispatcher-worker");

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    log.warn("worker.method_not_allowed", { method: req.method });
    return jsonResponse({ error: "method_not_allowed" }, 405, corsHeaders);
  }

  const auth = validateWorkerAuth(req);
  if (!auth.ok) {
    log.warn("worker.unauthorized", { code: auth.code });
    return jsonResponse({ error: auth.code }, auth.status, corsHeaders);
  }

  await initSentryEdge("message-dispatcher-worker");

  return withSpan("worker.run", "function", {}, async () => {
    const workerId = crypto.randomUUID();
    const budget = createWorkerWallClockBudget();
    log.info("worker.run.started", { worker_id: workerId });

    const totals: WorkerRunResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      batches: 0,
      budget_exceeded: false,
    };

    try {
      const supabase = createServiceRoleClient();

      while (!isWorkerWallClockExceeded(budget)) {
        const checkout = await withSpan(
          "checkout",
          "queue",
          { worker_id: workerId, batch: totals.batches! + 1 },
          () => checkoutBatch(supabase, workerId),
        );

        if (checkout.error) {
          log.error("worker.checkout.failed", {
            worker_id: workerId,
            batch: totals.batches! + 1,
            error: checkout.error.message,
          });
          break;
        }

        if (checkout.items.length === 0) {
          log.info("worker.queue_drained", {
            worker_id: workerId,
            batches_completed: totals.batches,
          });
          break;
        }

        const batchResult = await processCheckoutItemsSequential(
          supabase,
          checkout.items,
          workerId,
          undefined,
          budget,
        );

        totals.batches! += 1;
        totals.processed += batchResult.processed;
        totals.succeeded += batchResult.succeeded;
        totals.failed += batchResult.failed;
        totals.skipped! += batchResult.skipped;

        if (batchResult.budget_exceeded) {
          totals.budget_exceeded = true;
          break;
        }
      }

      if (!totals.budget_exceeded && isWorkerWallClockExceeded(budget)) {
        totals.budget_exceeded = true;
      }

      totals.wall_clock_ms = Math.round(workerWallClockElapsedMs(budget));
      log.info("worker.run.completed", { worker_id: workerId, ...totals });

      return jsonResponse(totals, 200, corsHeaders);
    } catch (err) {
      const message = err instanceof Error ? err.message : "worker_run_failed";
      log.error("worker.run.exception", {
        worker_id: workerId,
        error: message,
        batches_completed: totals.batches,
        processed_before_error: totals.processed,
      });
      return jsonResponse({ error: "worker_run_failed" }, 500, corsHeaders);
    }
  });
});
