import { assertEquals } from "std/testing/asserts";
import {
  isRiskAnalysisFailureCode,
  toClientFacingChargeFailureCode,
  toOpaqueTokenizeClientError,
} from "../client-facing-errors.ts";

Deno.test("toOpaqueTokenizeClientError always returns CARD_REJECTED", () => {
  assertEquals(toOpaqueTokenizeClientError(), {
    message: "Card was rejected",
    code: "CARD_REJECTED",
  });
});

Deno.test("isRiskAnalysisFailureCode matches fine RISK_ANALYSIS matrix", () => {
  assertEquals(isRiskAnalysisFailureCode("RISK_ANALYSIS_FRAUD_SUSPICION"), true);
  assertEquals(isRiskAnalysisFailureCode("RISK_ANALYSIS_NO_CONTACT"), true);
  assertEquals(isRiskAnalysisFailureCode("REJECTED"), false);
  assertEquals(isRiskAnalysisFailureCode(null), false);
});

Deno.test("toClientFacingChargeFailureCode maps risk analysis to RISK_REJECTED", () => {
  assertEquals(
    toClientFacingChargeFailureCode({
      code: "TERMINAL",
      message: "rejected",
      originalCode: "RISK_ANALYSIS_POLICY",
    }),
    "RISK_REJECTED",
  );
  assertEquals(
    toClientFacingChargeFailureCode({
      code: "TERMINAL",
      message: "rejected",
      originalCode: "RISK_ANALYSIS_FRAUD_SUSPICION",
    }),
    "RISK_REJECTED",
  );
});

Deno.test("toClientFacingChargeFailureCode keeps RETRYABLE and TERMINAL buckets", () => {
  assertEquals(
    toClientFacingChargeFailureCode({
      code: "RETRYABLE",
      message: "timeout",
    }),
    "RETRYABLE",
  );
  assertEquals(
    toClientFacingChargeFailureCode({
      code: "TERMINAL",
      message: "rejected",
      originalCode: "REJECTED",
    }),
    "TERMINAL",
  );
  assertEquals(
    toClientFacingChargeFailureCode({
      code: "REFERENCE_CODE_CONFLICT",
      message: "conflict",
    }),
    "RETRYABLE",
  );
});

Deno.test("toClientFacingChargeFailureCode never returns fine RISK_ANALYSIS codes", () => {
  const fineCodes = [
    "RISK_ANALYSIS_NO_CONTACT",
    "RISK_ANALYSIS_FRAUD_SUSPICION",
    "RISK_ANALYSIS_CANCELLED_DUPLICATE",
    "RISK_ANALYSIS_CONFIRMED_FRAUD",
    "RISK_ANALYSIS_BUSINESS_RULE",
    "RISK_ANALYSIS_POLICY",
    "RISK_ANALYSIS_MANUAL_FACILITATOR",
    "RISK_ANALYSIS_REJECTED",
  ];

  for (const originalCode of fineCodes) {
    const bucket = toClientFacingChargeFailureCode({
      code: "TERMINAL",
      message: "risk",
      originalCode,
    });
    assertEquals(bucket, "RISK_REJECTED");
    assertEquals(bucket?.startsWith("RISK_ANALYSIS_"), false);
  }
});
