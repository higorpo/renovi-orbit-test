// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { isManualPaymentEligible } from "../paymentSchedule.types";

describe("isManualPaymentEligible", () => {
  it("returns true for FAILED and FAILED_PERMANENT", () => {
    expect(isManualPaymentEligible("FAILED")).toBe(true);
    expect(isManualPaymentEligible("FAILED_PERMANENT")).toBe(true);
  });

  it("returns false for other states", () => {
    expect(isManualPaymentEligible("SCHEDULED")).toBe(false);
    expect(isManualPaymentEligible("PAID")).toBe(false);
    expect(isManualPaymentEligible("CANCELLED")).toBe(false);
    expect(isManualPaymentEligible("PROCESSING")).toBe(false);
    expect(isManualPaymentEligible("IN_ANALYSIS")).toBe(false);
  });
});
