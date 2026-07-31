import {
  mapSettlementMovementToUpsertItem,
  type SettlementMovementSource,
  type SettlementMovementUpsertItem,
} from "../_shared/payment/mapSettlementMovementUpsert.ts";
import type {
  SettlementSyncSchedule,
  SettlementSyncScheduleResult,
  SettlementSyncUpsertResult,
} from "./types.ts";

export type ProcessSettlementSyncDeps = {
  listMovementsByTransactionId: (
    transactionId: string,
  ) => Promise<SettlementMovementSource[]>;
  upsertSettlementMovements: (
    movements: SettlementMovementUpsertItem[],
  ) => Promise<SettlementSyncUpsertResult>;
};

export function mapGraphqlMovementsToUpsertItems(
  movements: SettlementMovementSource[],
  fallbackTransactionId: string,
): SettlementMovementUpsertItem[] {
  const items: SettlementMovementUpsertItem[] = [];

  for (const movement of movements) {
    const withTx: SettlementMovementSource = {
      ...movement,
      transactionId: movement.transactionId ?? fallbackTransactionId,
    };
    const item = mapSettlementMovementToUpsertItem(withTx, "graphql_reconcile");
    if (item) {
      items.push(item);
    }
  }

  return items;
}

export async function processSettlementSyncSchedule(
  deps: ProcessSettlementSyncDeps,
  schedule: SettlementSyncSchedule,
): Promise<SettlementSyncScheduleResult> {
  const transactionId = schedule.gateway_transaction_id?.trim() ?? "";
  if (!transactionId) {
    return {
      scheduleId: schedule.id,
      outcome: "skipped",
      movementCount: 0,
      upserted: 0,
      skippedPlatform: 0,
      skippedNotFound: 0,
      skippedInvalid: 0,
      error: "missing_gateway_transaction_id",
    };
  }

  try {
    const movements = await deps.listMovementsByTransactionId(transactionId);
    const items = mapGraphqlMovementsToUpsertItems(movements, transactionId);

    if (items.length === 0) {
      return {
        scheduleId: schedule.id,
        outcome: "empty",
        movementCount: movements.length,
        upserted: 0,
        skippedPlatform: 0,
        skippedNotFound: 0,
        skippedInvalid: 0,
      };
    }

    const upsert = await deps.upsertSettlementMovements(items);

    return {
      scheduleId: schedule.id,
      outcome: "upserted",
      movementCount: items.length,
      upserted: upsert.upserted,
      skippedPlatform: upsert.skipped_platform,
      skippedNotFound: upsert.skipped_not_found,
      skippedInvalid: upsert.skipped_invalid,
    };
  } catch (error) {
    return {
      scheduleId: schedule.id,
      outcome: "failure",
      movementCount: 0,
      upserted: 0,
      skippedPlatform: 0,
      skippedNotFound: 0,
      skippedInvalid: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
