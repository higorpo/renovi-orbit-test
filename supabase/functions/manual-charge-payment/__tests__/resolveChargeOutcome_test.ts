import { assertEquals } from "std/testing/asserts";
import type { CreateChargeResult } from "../../_shared/payment/types.ts";
import { resolveChargeOutcome } from "../resolveChargeOutcome.ts";

Deno.test("resolveChargeOutcome returns PAID for successful paid charge", () => {
  const result: CreateChargeResult = {
    success: true,
    transactionState: "PAID",
    chargeId: "c1",
    transactionId: "t1",
  };
  assertEquals(resolveChargeOutcome(result), "PAID");
});

Deno.test("resolveChargeOutcome returns IN_ANALYSIS for successful analysis charge", () => {
  const result: CreateChargeResult = {
    success: true,
    transactionState: "IN_ANALYSIS",
    chargeId: "c1",
    transactionId: "t1",
  };
  assertEquals(resolveChargeOutcome(result), "IN_ANALYSIS");
});

Deno.test("resolveChargeOutcome returns FAILED_PERMANENT for terminal errors", () => {
  const result: CreateChargeResult = {
    success: false,
    transactionState: "REJECTED",
    error: { code: "TERMINAL", message: "rejected", originalCode: "REJECTED" },
  };
  assertEquals(resolveChargeOutcome(result), "FAILED_PERMANENT");
});

Deno.test("resolveChargeOutcome returns FAILED for retryable errors", () => {
  const result: CreateChargeResult = {
    success: false,
    transactionState: null,
    error: { code: "TIMEOUT", message: "timeout" },
  };
  assertEquals(resolveChargeOutcome(result), "FAILED");
});
