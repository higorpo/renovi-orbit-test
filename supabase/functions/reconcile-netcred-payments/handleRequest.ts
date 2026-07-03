import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import { validateOrbitCronAuth } from "../_shared/security/orbit-cron-auth.ts";
import {
  processReconcileSchedule,
  type ProcessReconcileScheduleDeps,
} from "./processSchedule.ts";
import type { ReconcileRunSummary, ReconcileSchedule } from "./types.ts";

const logger = createPaymentLogger("reconcile-netcred-payments");

export type ReconcileNetcredPaymentsDeps = {
  listStaleSchedules: (batchSize?: number) => Promise<ReconcileSchedule[]>;
  processSchedule: (
    schedule: ReconcileSchedule,
  ) => Promise<Awaited<ReturnType<typeof processReconcileSchedule>>>;
};

function emptySummary(): ReconcileRunSummary {
  return {
    processed: 0,
    applied: 0,
    skipped: 0,
    failures: 0,
    warnings_emitted: 0,
  };
}

export async function handleReconcileNetcredPaymentsRequest(
  req: Request,
  deps: ReconcileNetcredPaymentsDeps,
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

  const schedules = await deps.listStaleSchedules();
  const summary = emptySummary();

  for (const schedule of schedules) {
    summary.processed += 1;

    try {
      const result = await deps.processSchedule(schedule);

      switch (result.outcome) {
        case "PAID":
        case "FAILED_PERMANENT":
        case "REFUNDED":
        case "PARTIALLY_REFUNDED":
        case "IN_ANALYSIS":
          summary.applied += 1;
          break;
        case "FAILURE":
          summary.failures += 1;
          if ((result.failureCount ?? 0) > 3) {
            summary.warnings_emitted += 1;
          }
          break;
        default:
          summary.skipped += 1;
      }
    } catch (error) {
      summary.failures += 1;
      logger.error("reconcile_schedule_failed", {
        schedule_id: schedule.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("reconcile_completed", summary);

  return jsonResponse(summary, 200, cors);
}

export type { ProcessReconcileScheduleDeps };
