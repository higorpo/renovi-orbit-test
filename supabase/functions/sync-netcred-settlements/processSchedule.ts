import {
  enrichSettlementMovementsForTransaction,
  mapGraphqlMovementsToUpsertItems,
  type EnrichSettlementDeps,
  type EnrichSettlementResult,
} from "../_shared/payment/enrichSettlementMovements.ts";
import type {
  SettlementSyncSchedule,
  SettlementSyncScheduleResult,
} from "./types.ts";

export type ProcessSettlementSyncDeps = EnrichSettlementDeps;

export { mapGraphqlMovementsToUpsertItems };

export async function processSettlementSyncSchedule(
  deps: ProcessSettlementSyncDeps,
  schedule: SettlementSyncSchedule,
): Promise<SettlementSyncScheduleResult> {
  const result: EnrichSettlementResult =
    await enrichSettlementMovementsForTransaction(
      deps,
      schedule.gateway_transaction_id ?? "",
    );

  return {
    scheduleId: schedule.id,
    outcome: result.outcome,
    movementCount: result.movementCount,
    upserted: result.upserted,
    skippedPlatform: result.skippedPlatform,
    skippedNotFound: result.skippedNotFound,
    skippedInvalid: result.skippedInvalid,
    error: result.error,
  };
}
