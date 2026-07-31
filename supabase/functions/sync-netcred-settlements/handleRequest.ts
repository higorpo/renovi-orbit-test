import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import { validateOrbitCronAuth } from "../_shared/security/orbit-cron-auth.ts";
import {
  processSettlementSyncSchedule,
  type ProcessSettlementSyncDeps,
} from "./processSchedule.ts";
import type {
  SettlementSyncRunSummary,
  SettlementSyncSchedule,
} from "./types.ts";

const logger = createPaymentLogger("sync-netcred-settlements");

export type SyncNetcredSettlementsDeps = {
  listSchedulesNeedingSync: (batchSize?: number) => Promise<SettlementSyncSchedule[]>;
  processSchedule: (
    schedule: SettlementSyncSchedule,
  ) => Promise<Awaited<ReturnType<typeof processSettlementSyncSchedule>>>;
};

function emptySummary(): SettlementSyncRunSummary {
  return {
    processed: 0,
    upserted_schedules: 0,
    empty: 0,
    skipped: 0,
    failures: 0,
    movements_upserted: 0,
    movements_skipped_platform: 0,
    movements_skipped_not_found: 0,
    movements_skipped_invalid: 0,
  };
}

export async function handleSyncNetcredSettlementsRequest(
  req: Request,
  deps: SyncNetcredSettlementsDeps,
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

  const schedules = await deps.listSchedulesNeedingSync();
  const summary = emptySummary();

  for (const schedule of schedules) {
    summary.processed += 1;

    try {
      const result = await deps.processSchedule(schedule);

      switch (result.outcome) {
        case "upserted":
          summary.upserted_schedules += 1;
          summary.movements_upserted += result.upserted;
          summary.movements_skipped_platform += result.skippedPlatform;
          summary.movements_skipped_not_found += result.skippedNotFound;
          summary.movements_skipped_invalid += result.skippedInvalid;
          break;
        case "empty":
          summary.empty += 1;
          break;
        case "failure":
          summary.failures += 1;
          logger.error("settlement_sync_schedule_failed", {
            schedule_id: schedule.id,
            gateway_transaction_id: schedule.gateway_transaction_id,
            error: result.error,
          });
          break;
        default:
          summary.skipped += 1;
      }
    } catch (error) {
      summary.failures += 1;
      logger.error("settlement_sync_schedule_failed", {
        schedule_id: schedule.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("settlement_sync_completed", summary);

  return jsonResponse(summary, 200, cors);
}

export type { ProcessSettlementSyncDeps };
