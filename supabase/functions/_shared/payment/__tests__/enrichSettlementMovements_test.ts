import { assertEquals } from "std/testing/asserts";
import type { SettlementMovementSource } from "../mapSettlementMovementUpsert.ts";
import {
  enrichSettlementMovementsForTransaction,
  extractGatewayTransactionIdFromPayload,
  isTransactionSettlementEnrichEvent,
  mapGraphqlMovementsToUpsertItems,
} from "../enrichSettlementMovements.ts";

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

Deno.test("isTransactionSettlementEnrichEvent matches CAPTURE and REFUND only", () => {
  assertEquals(isTransactionSettlementEnrichEvent("TRANSACTION_CAPTURE"), true);
  assertEquals(isTransactionSettlementEnrichEvent("transaction_refund"), true);
  assertEquals(isTransactionSettlementEnrichEvent("PAYOUT_CREATE"), false);
  assertEquals(isTransactionSettlementEnrichEvent("TRANSACTION_UPDATE"), false);
});

Deno.test("extractGatewayTransactionIdFromPayload prefers top-level numeric id", () => {
  assertEquals(
    extractGatewayTransactionIdFromPayload({
      id: 446534,
      uuid: "f6412196-35fb-4716-b308-0e2cfea7c970",
    }),
    "446534",
  );
});

Deno.test("extractGatewayTransactionIdFromPayload falls back to nested transaction.id", () => {
  assertEquals(
    extractGatewayTransactionIdFromPayload({
      transaction: { id: "446534" },
    }),
    "446534",
  );
});

Deno.test("extractGatewayTransactionIdFromPayload returns null when missing", () => {
  assertEquals(extractGatewayTransactionIdFromPayload({}), null);
  assertEquals(extractGatewayTransactionIdFromPayload(null), null);
});

Deno.test("mapGraphqlMovementsToUpsertItems sets graphql_reconcile sync_source", () => {
  const items = mapGraphqlMovementsToUpsertItems([providerMovement], "444677");
  assertEquals(items.length, 1);
  assertEquals(items[0]?.sync_source, "graphql_reconcile");
  assertEquals(items[0]?.gateway_movement_id, "98765");
});

Deno.test("enrichSettlementMovementsForTransaction lists, maps and upserts", async () => {
  const upserted: unknown[] = [];
  const result = await enrichSettlementMovementsForTransaction(
    {
      listMovementsByTransactionId: async (transactionId) => {
        assertEquals(transactionId, "446534");
        return [providerMovement];
      },
      upsertSettlementMovements: async (movements) => {
        upserted.push(movements);
        return {
          upserted: 1,
          skipped_platform: 0,
          skipped_not_found: 0,
          skipped_invalid: 0,
        };
      },
    },
    "446534",
  );

  assertEquals(result.outcome, "upserted");
  assertEquals(result.upserted, 1);
  assertEquals(upserted.length, 1);
});

Deno.test("enrichSettlementMovementsForTransaction returns empty without upsert", async () => {
  const result = await enrichSettlementMovementsForTransaction(
    {
      listMovementsByTransactionId: async () => [],
      upsertSettlementMovements: async () => {
        throw new Error("should not upsert");
      },
    },
    "446534",
  );

  assertEquals(result.outcome, "empty");
  assertEquals(result.upserted, 0);
});

Deno.test("enrichSettlementMovementsForTransaction returns failure on GraphQL error", async () => {
  const result = await enrichSettlementMovementsForTransaction(
    {
      listMovementsByTransactionId: async () => {
        throw new Error("graphql down");
      },
      upsertSettlementMovements: async () => {
        throw new Error("should not upsert");
      },
    },
    "446534",
  );

  assertEquals(result.outcome, "failure");
  assertEquals(result.error, "graphql down");
});
