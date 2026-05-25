/**
 * Edge Function: message-dispatcher-worker (design §5.5).
 *
 * Stateless worker: checkout → sequential render/send/report per dispatch.
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
    log.info("worker.run.started", { worker_id: workerId });

    try {
      const supabase = createServiceRoleClient();
      const checkout = await withSpan(
        "checkout",
        "queue",
        { worker_id: workerId },
        () => checkoutBatch(supabase, workerId),
      );
      if (checkout.error) {
        log.error("worker.checkout.failed", {
          worker_id: workerId,
          error: checkout.error.message,
        });
        return jsonResponse({ error: "checkout_failed" }, 500, corsHeaders);
      }

      const result: WorkerRunResult = await processCheckoutItemsSequential(
        supabase,
        checkout.items,
        workerId,
      );

      log.info("worker.run.completed", { worker_id: workerId, ...result });

      return jsonResponse(result, 200, corsHeaders);
    } catch (err) {
      const message = err instanceof Error ? err.message : "worker_run_failed";
      log.error("worker.run.exception", { worker_id: workerId, error: message });
      return jsonResponse({ error: "worker_run_failed" }, 500, corsHeaders);
    }
  });
});
