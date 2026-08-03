/**
 * GraphQL settlement enrich: list movements by transaction and upsert.
 * Used by sync-netcred-settlements and TRANSACTION_CAPTURE / REFUND webhook path.
 */
import {
  mapSettlementMovementToUpsertItem,
  type SettlementMovementSource,
  type SettlementMovementUpsertItem,
} from "./mapSettlementMovementUpsert.ts";

export type EnrichSettlementUpsertResult = {
  upserted: number;
  skipped_platform: number;
  skipped_not_found: number;
  skipped_invalid: number;
  results?: unknown[];
};

export type EnrichSettlementResult = {
  transactionId: string;
  outcome: "upserted" | "empty" | "skipped" | "failure";
  movementCount: number;
  upserted: number;
  skippedPlatform: number;
  skippedNotFound: number;
  skippedInvalid: number;
  error?: string;
};

export type EnrichSettlementDeps = {
  listMovementsByTransactionId: (
    transactionId: string,
  ) => Promise<SettlementMovementSource[]>;
  upsertSettlementMovements: (
    movements: SettlementMovementUpsertItem[],
  ) => Promise<EnrichSettlementUpsertResult>;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function readNested(
  payload: Record<string, unknown>,
  path: string[],
): unknown {
  let current: unknown = payload;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Prefer Netcred numeric transaction id (matches gateway_transaction_id / GraphQL filter). */
export function extractGatewayTransactionIdFromPayload(
  payload: Record<string, unknown> | null | undefined,
): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const paths: string[][] = [
    ["id"],
    ["uuid"],
    ["transaction", "id"],
    ["transaction", "uuid"],
  ];

  for (const path of paths) {
    const value = asTrimmedString(readNested(payload, path));
    if (value) {
      return value;
    }
  }

  return null;
}

export function isTransactionSettlementEnrichEvent(eventType: string): boolean {
  const normalized = eventType.trim().toUpperCase();
  return (
    normalized === "TRANSACTION_CAPTURE" ||
    normalized === "TRANSACTION_REFUND"
  );
}

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

export async function enrichSettlementMovementsForTransaction(
  deps: EnrichSettlementDeps,
  transactionId: string,
): Promise<EnrichSettlementResult> {
  const trimmed = transactionId.trim();
  if (!trimmed) {
    return {
      transactionId: "",
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
    const movements = await deps.listMovementsByTransactionId(trimmed);
    const items = mapGraphqlMovementsToUpsertItems(movements, trimmed);

    if (items.length === 0) {
      return {
        transactionId: trimmed,
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
      transactionId: trimmed,
      outcome: "upserted",
      movementCount: items.length,
      upserted: upsert.upserted,
      skippedPlatform: upsert.skipped_platform,
      skippedNotFound: upsert.skipped_not_found,
      skippedInvalid: upsert.skipped_invalid,
    };
  } catch (error) {
    return {
      transactionId: trimmed,
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
