import { assertEquals } from "std/testing/asserts";
import type { GetTransactionResult } from "../../_shared/payment/types.ts";
import { mapGatewayState, resolveReconcileGatewayState } from "../mapGatewayState.ts";

function tx(
  state: GetTransactionResult["transactionState"],
): GetTransactionResult {
  return {
    referenceCode: "ref-1",
    transactionState: state,
    chargeId: "c1",
    transactionId: "t1",
  };
}

Deno.test("mapGatewayState returns null for missing transaction", () => {
  assertEquals(mapGatewayState(null), null);
});

Deno.test("mapGatewayState returns transactionState", () => {
  assertEquals(mapGatewayState(tx("PAID")), "PAID");
  assertEquals(mapGatewayState(tx("IN_ANALYSIS")), "IN_ANALYSIS");
});

Deno.test("resolveReconcileGatewayState returns null when gateway state is null", () => {
  assertEquals(resolveReconcileGatewayState(null, "PROCESSING"), null);
});

Deno.test("resolveReconcileGatewayState keeps IN_ANALYSIS when already IN_ANALYSIS", () => {
  assertEquals(
    resolveReconcileGatewayState("IN_ANALYSIS", "IN_ANALYSIS"),
    "IN_ANALYSIS",
  );
});

Deno.test("resolveReconcileGatewayState maps supported terminal and analysis states", () => {
  assertEquals(resolveReconcileGatewayState("PAID", "PROCESSING"), "PAID");
  assertEquals(resolveReconcileGatewayState("REJECTED", "PROCESSING"), "REJECTED");
  assertEquals(resolveReconcileGatewayState("REFUNDED", "PAID"), "REFUNDED");
  assertEquals(
    resolveReconcileGatewayState("PARTIALLY_REFUNDED", "PAID"),
    "PARTIALLY_REFUNDED",
  );
  assertEquals(
    resolveReconcileGatewayState("IN_ANALYSIS", "PROCESSING"),
    "IN_ANALYSIS",
  );
});

Deno.test("resolveReconcileGatewayState ignores unsupported gateway states", () => {
  assertEquals(resolveReconcileGatewayState("VOIDED", "PROCESSING"), null);
  assertEquals(resolveReconcileGatewayState("EXPIRED", "PROCESSING"), null);
});
