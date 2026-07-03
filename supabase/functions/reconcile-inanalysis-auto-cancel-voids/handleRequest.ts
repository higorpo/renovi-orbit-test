import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import { validateOrbitCronAuth } from "../_shared/security/orbit-cron-auth.ts";
import {
  processInanalysisVoidSchedule,
  type ProcessInanalysisVoidDeps,
} from "./processSchedule.ts";
import type { InanalysisVoidSchedule, VoidRunSummary } from "./types.ts";

const logger = createPaymentLogger("reconcile-inanalysis-auto-cancel-voids");

export type ReconcileInanalysisAutoCancelVoidsDeps = {
  listPendingSchedules: (batchSize?: number) => Promise<InanalysisVoidSchedule[]>;
  processSchedule: (
    schedule: InanalysisVoidSchedule,
  ) => Promise<Awaited<ReturnType<typeof processInanalysisVoidSchedule>>>;
};

function emptySummary(): VoidRunSummary {
  return {
    processed: 0,
    voided: 0,
    deferred: 0,
    already_terminal: 0,
    failures: 0,
    warnings_emitted: 0,
  };
}

export async function handleReconcileInanalysisAutoCancelVoidsRequest(
  req: Request,
  deps: ReconcileInanalysisAutoCancelVoidsDeps,
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

  const schedules = await deps.listPendingSchedules();
  const summary = emptySummary();

  for (const schedule of schedules) {
    summary.processed += 1;

    try {
      const result = await deps.processSchedule(schedule);

      switch (result.outcome) {
        case "VOIDED":
          summary.voided += 1;
          break;
        case "DEFERRED":
          summary.deferred += 1;
          summary.warnings_emitted += 1;
          break;
        case "ALREADY_TERMINAL":
          summary.already_terminal += 1;
          break;
        case "FAILURE":
          summary.failures += 1;
          if ((result.failureCount ?? 0) >= 3) {
            summary.warnings_emitted += 1;
          }
          break;
        default:
          break;
      }
    } catch (error) {
      summary.failures += 1;
      logger.error("inanalysis_void_schedule_failed", {
        schedule_id: schedule.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("inanalysis_void_reconcile_completed", summary);

  return jsonResponse(summary, 200, cors);
}

export type { ProcessInanalysisVoidDeps };
