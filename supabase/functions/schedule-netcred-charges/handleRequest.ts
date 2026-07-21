import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import {
  createPaymentLogger,
  PAYMENT_LOG_EVENTS,
} from "../_shared/observability/payment-logger.ts";
import { validateOrbitCronAuth } from "../_shared/security/orbit-cron-auth.ts";
import { processSchedule, type ProcessScheduleDeps } from "./processSchedule.ts";
import type { CronChargeSchedule, CronRunSummary } from "./types.ts";

const logger = createPaymentLogger("schedule-netcred-charges");

/**
 * Wall-clock budget for sequential charge processing under pg_net invoke timeout.
 * Default leaves headroom under 90s charge-cron timeout (and legacy 55s).
 * Leftover claimed schedules stay PROCESSING until lease orphan (see PROCESSING_LEFTOVER_POLICY.md).
 */
export const DEFAULT_INVOKE_DEADLINE_MS = 45_000;

export type ScheduleNetcredChargesDeps = {
  dequeueSchedules: (batchSize?: number) => Promise<CronChargeSchedule[]>;
  processSchedule: (
    schedule: CronChargeSchedule,
  ) => Promise<Awaited<ReturnType<typeof processSchedule>>>;
  captureException: (error: unknown, extra: Record<string, unknown>) => void;
  maxAttempts: number;
  /** Override invoke start (tests). */
  invokeStartedAtMs?: number;
  /** Stop starting new charges after this many ms (default 45s). */
  invokeDeadlineMs?: number;
  now?: () => number;
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
    skipped_deadline: 0,
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

  const now = deps.now ?? Date.now;
  const startedAt = deps.invokeStartedAtMs ?? now();
  const deadlineMs = deps.invokeDeadlineMs ?? DEFAULT_INVOKE_DEADLINE_MS;

  const schedules = await deps.dequeueSchedules();
  const summary = emptySummary();

  for (const schedule of schedules) {
    if (now() - startedAt >= deadlineMs) {
      // Unstarted claimed rows stay PROCESSING until lease orphan (CHK-022 policy).
      summary.skipped_deadline = schedules.length - summary.processed;
      logger.warn(PAYMENT_LOG_EVENTS.CHARGE_BATCH_DEADLINE_REACHED, {
        schedule_id: schedule.id,
        service_id: schedule.contracted_service_id,
        elapsed_ms: now() - startedAt,
        deadline_ms: deadlineMs,
        skipped_deadline: summary.skipped_deadline,
      });
      break;
    }

    summary.processed += 1;

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
