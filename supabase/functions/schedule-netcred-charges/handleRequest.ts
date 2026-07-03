import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import {
  createPaymentLogger,
  PAYMENT_LOG_EVENTS,
} from "../_shared/observability/payment-logger.ts";
import { validateOrbitCronAuth } from "../_shared/security/orbit-cron-auth.ts";
import { logAndReleaseDryRunSchedule } from "./dryRunProcessSchedule.ts";
import { processSchedule, type ProcessScheduleDeps } from "./processSchedule.ts";
import type { CronChargeSchedule, CronRunSummary } from "./types.ts";

const logger = createPaymentLogger("schedule-netcred-charges");

export type ScheduleNetcredChargesDeps = {
  dequeueSchedules: (batchSize?: number) => Promise<CronChargeSchedule[]>;
  processSchedule: (
    schedule: CronChargeSchedule,
  ) => Promise<Awaited<ReturnType<typeof processSchedule>>>;
  captureException: (error: unknown, extra: Record<string, unknown>) => void;
  maxAttempts: number;
  isDryRun?: () => Promise<boolean>;
  revertDryRunLease?: (
    scheduleId: string,
    attemptCount: number,
  ) => Promise<void>;
};

function emptySummary(): CronRunSummary {
  return {
    processed: 0,
    paid: 0,
    failed: 0,
    failed_permanent: 0,
    in_analysis: 0,
    reconciled: 0,
    errors: 0,
    dry_run: 0,
  };
}

export async function handleScheduleNetcredChargesRequest(
  req: Request,
  deps: ScheduleNetcredChargesDeps,
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

  const schedules = await deps.dequeueSchedules();
  const summary = emptySummary();
  const dryRun = await deps.isDryRun?.() ?? false;

  for (const schedule of schedules) {
    summary.processed += 1;

    if (dryRun && deps.revertDryRunLease) {
      try {
        await logAndReleaseDryRunSchedule(schedule, deps.revertDryRunLease);
        summary.dry_run = (summary.dry_run ?? 0) + 1;
      } catch (error) {
        summary.errors += 1;
        deps.captureException(error, {
          schedule_id: schedule.id,
          contracted_service_id: schedule.contracted_service_id,
          automatic_attempt_count: schedule.automatic_attempt_count,
          gateway_slug: schedule.gateway_slug,
          current_state: "PROCESSING",
          dry_run: true,
        });
      }
      continue;
    }

    try {
      const result = await deps.processSchedule(schedule);

      if (result.reconciled) {
        summary.reconciled += 1;
      }

      switch (result.outcome) {
        case "PAID":
          summary.paid += 1;
          break;
        case "FAILED":
          summary.failed += 1;
          break;
        case "FAILED_PERMANENT":
          summary.failed_permanent += 1;
          break;
        case "IN_ANALYSIS":
          summary.in_analysis += 1;
          break;
      }
    } catch (error) {
      summary.errors += 1;
      deps.captureException(error, {
        schedule_id: schedule.id,
        contracted_service_id: schedule.contracted_service_id,
        automatic_attempt_count: schedule.automatic_attempt_count,
        gateway_slug: schedule.gateway_slug,
        current_state: "PROCESSING",
      });
      logger.error(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_FAILED, {
        service_id: schedule.contracted_service_id,
        schedule_id: schedule.id,
        gateway_slug: schedule.gateway_slug,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return jsonResponse(summary, 200, cors);
}

export type { ProcessScheduleDeps };
