import { assertEquals } from "std/testing/asserts";
import {
  mapGraphqlMovementsToUpsertItems,
  processSettlementSyncSchedule,
  type ProcessSettlementSyncDeps,
} from "../processSchedule.ts";
import type { SettlementSyncSchedule } from "../types.ts";
import type { SettlementMovementSource } from "../../_shared/payment/mapSettlementMovementUpsert.ts";

const schedule: SettlementSyncSchedule = {
  id: "schedule-1",
  provider_id: "provider-1",
  state: "PAID",
  gateway_transaction_id: "444677",
  gateway_slug: "netcred",
  netcred_company_id: "1048",
  paid_at: "2026-07-01T12:00:00Z",
};

const providerMovement: SettlementMovementSource = {
  id: "98765",
  amount: "1500.00",
  netAmount: "1470.00",
  movementStatus: "PENDING",
  movementType: "CARD_PAYMENT",
  movementSource: "TRANSACTION",
  recordType: "CREDIT",
  installment: 1,
  baseSettleDate: "2026-06-15",
  settlingAt: "2026-06-15",
  settledAt: null,
  isAdvance: false,
  brand: "MCC",
  bankAccountNumber: "1234567-7",
  bankCompe: "001",
  bankName: "Banco do Brasil",
  holderCompanyId: "1048",
  companyId: "1014",
  payoutId: "12345",
  payoutStatus: "PENDING",
  transactionId: "444677",
};

Deno.test("mapGraphqlMovementsToUpsertItems sets graphql_reconcile sync_source", () => {
  const items = mapGraphqlMovementsToUpsertItems([providerMovement], "444677");
  assertEquals(items.length, 1);
  assertEquals(items[0]?.sync_source, "graphql_reconcile");
  assertEquals(items[0]?.gateway_movement_id, "98765");
  assertEquals(items[0]?.holder_company_id, "1048");
  assertEquals(items[0]?.is_refund_clawback, false);
  assertEquals(items[0]?.bank_account_mask, "Banco do Brasil ****5677");
});

Deno.test("mapGraphqlMovementsToUpsertItems marks DEBIT as clawback", () => {
  const items = mapGraphqlMovementsToUpsertItems(
    [{ ...providerMovement, id: "2", recordType: "DEBIT" }],
    "444677",
  );
  assertEquals(items[0]?.is_refund_clawback, true);
  assertEquals(items[0]?.record_type, "DEBIT");
});

Deno.test("processSettlementSyncSchedule upserts mapped GraphQL movements", async () => {
  const upsertedBatches: unknown[] = [];
  const deps: ProcessSettlementSyncDeps = {
    listMovementsByTransactionId: async (transactionId) => {
      assertEquals(transactionId, "444677");
      return [providerMovement, {
        ...providerMovement,
        id: "platform-leg",
        holderCompanyId: "1014",
      }];
    },
    upsertSettlementMovements: async (movements) => {
      upsertedBatches.push(movements);
      return {
        upserted: 1,
        skipped_platform: 1,
        skipped_not_found: 0,
        skipped_invalid: 0,
      };
    },
  };

  const result = await processSettlementSyncSchedule(deps, schedule);
  assertEquals(result.outcome, "upserted");
  assertEquals(result.upserted, 1);
  assertEquals(result.skippedPlatform, 1);
  assertEquals(upsertedBatches.length, 1);
  assertEquals((upsertedBatches[0] as { sync_source: string }[])[0]?.sync_source, "graphql_reconcile");
});

Deno.test("processSettlementSyncSchedule returns empty when GraphQL has no movements", async () => {
  const deps: ProcessSettlementSyncDeps = {
    listMovementsByTransactionId: async () => [],
    upsertSettlementMovements: async () => {
      throw new Error("should not upsert");
    },
  };

  const result = await processSettlementSyncSchedule(deps, schedule);
  assertEquals(result.outcome, "empty");
  assertEquals(result.upserted, 0);
});

Deno.test("processSettlementSyncSchedule returns failure on GraphQL error", async () => {
  const deps: ProcessSettlementSyncDeps = {
    listMovementsByTransactionId: async () => {
      throw new Error("gateway unavailable");
    },
    upsertSettlementMovements: async () => ({
      upserted: 0,
      skipped_platform: 0,
      skipped_not_found: 0,
      skipped_invalid: 0,
    }),
  };

  const result = await processSettlementSyncSchedule(deps, schedule);
  assertEquals(result.outcome, "failure");
  assertEquals(result.error, "gateway unavailable");
});

Deno.test("processSettlementSyncSchedule skips when gateway_transaction_id is missing", async () => {
  const deps: ProcessSettlementSyncDeps = {
    listMovementsByTransactionId: async () => {
      throw new Error("should not list");
    },
    upsertSettlementMovements: async () => {
      throw new Error("should not upsert");
    },
  };

  const whitespace = await processSettlementSyncSchedule(deps, {
    ...schedule,
    gateway_transaction_id: "   ",
  });
  assertEquals(whitespace.outcome, "skipped");
  assertEquals(whitespace.error, "missing_gateway_transaction_id");

  const missing = await processSettlementSyncSchedule(deps, {
    ...schedule,
    gateway_transaction_id: undefined as unknown as string,
  });
  assertEquals(missing.outcome, "skipped");
  assertEquals(missing.error, "missing_gateway_transaction_id");
});
Deno.test("processSettlementSyncSchedule stringifies non-Error failures", async () => {
  const deps: ProcessSettlementSyncDeps = {
    listMovementsByTransactionId: async () => {
      throw "gateway string failure";
    },
    upsertSettlementMovements: async () => ({
      upserted: 0,
      skipped_platform: 0,
      skipped_not_found: 0,
      skipped_invalid: 0,
    }),
  };

  const result = await processSettlementSyncSchedule(deps, schedule);
  assertEquals(result.outcome, "failure");
  assertEquals(result.error, "gateway string failure");
});

Deno.test("mapGraphqlMovementsToUpsertItems falls back to schedule transaction id", () => {
  const items = mapGraphqlMovementsToUpsertItems(
    [{ ...providerMovement, transactionId: null }],
    "fallback-tx",
  );
  assertEquals(items.length, 1);
  assertEquals(items[0]?.gateway_transaction_id, "fallback-tx");
});

Deno.test("mapGraphqlMovementsToUpsertItems drops invalid movements", () => {
  const items = mapGraphqlMovementsToUpsertItems(
    [
      { ...providerMovement, id: "" },
      { ...providerMovement, id: "valid-2" },
    ],
    "444677",
  );
  assertEquals(items.length, 1);
  assertEquals(items[0]?.gateway_movement_id, "valid-2");
});

Deno.test("processSettlementSyncSchedule returns empty when all movements are invalid", async () => {
  const deps: ProcessSettlementSyncDeps = {
    listMovementsByTransactionId: async () => [
      { ...providerMovement, id: "" },
    ],
    upsertSettlementMovements: async () => {
      throw new Error("should not upsert");
    },
  };

  const result = await processSettlementSyncSchedule(deps, schedule);
  assertEquals(result.outcome, "empty");
  assertEquals(result.movementCount, 1);
  assertEquals(result.upserted, 0);
});
