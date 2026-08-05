/**
 * generate-completion-checklist — post-create async enrichment worker (design §5.2).
 * Auth: X-Orbit-Cron-Secret / service_role bearer (verify_jwt = false).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  SERVICE_COMPLETION_LOG_EVENTS,
  createServiceCompletionLogger,
} from "../_shared/observability/service-completion-logger.ts";
import { initSentryEdge, withSpan } from "../_shared/sentrySpans.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import { FUNCTION_NAME } from "./constants.ts";
import { createGenerateCompletionChecklistDeps } from "./createDeps.ts";
import { handleGenerateCompletionChecklistRequest } from "./handleRequest.ts";

const log = createServiceCompletionLogger(FUNCTION_NAME);

serve(async (req) => {
  try {
    await initSentryEdge(FUNCTION_NAME);
    const supabase = createServiceRoleClient();
    const deps = createGenerateCompletionChecklistDeps(supabase);
    return await withSpan(
      FUNCTION_NAME,
      "service_completion.enrichment",
      { feature: "service_completion", outcome: "enrichment_batch" },
      () => handleGenerateCompletionChecklistRequest(req, deps),
    );
  } catch (error) {
    log.error(SERVICE_COMPLETION_LOG_EVENTS.ENRICHMENT_WORKER_FATAL, {
      outcome: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
