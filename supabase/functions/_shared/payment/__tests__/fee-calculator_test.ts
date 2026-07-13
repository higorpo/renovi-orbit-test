import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  PAYMENT_PLATFORM_CONSTANT_DEFAULTS,
} from "../constants.ts";
import {
  calculateChargeAmount,
  mirrorRpcChargeAmount,
} from "../fee-calculator.ts";

Deno.test("calculateChargeAmount uses NetCred gross-up with processing + risk", () => {
  const constants = { ...PAYMENT_PLATFORM_CONSTANT_DEFAULTS };
  // (1000 + 0.39 + 0.49) / (1 - 2.39/100) = 1000.88 / 0.9761 ≈ 1025.39
  const oneX = calculateChargeAmount(1000, "MASTER", 1, constants);
  assertEquals(oneX.applicable_rate_pct, 2.39);
  assertEquals(oneX.total_with_fees, 1025.39);
  assertEquals(oneX.installment_amount, 1025.39);

  // (1000 + 0.88) / (1 - 2.59/100) ≈ 1027.49
  const fourX = calculateChargeAmount(1000, "MASTER", 4, constants);
  assertEquals(fourX.applicable_rate_pct, 2.59);
  assertEquals(fourX.total_with_fees, 1027.49);
  assertEquals(fourX.installment_amount, 256.87);
});

Deno.test("calculateChargeAmount sandbox example base 5000 Visa 12x", () => {
  const constants = {
    ...PAYMENT_PLATFORM_CONSTANT_DEFAULTS,
    cc_visa_master_7_12x_rate: 4.8,
    cc_fixed_processing_fee_brl: 4.9,
    cc_risk_analysis_fee_brl: 5,
  };
  // (5000 + 4.90 + 5.00) / (1 - 4.80/100) = 5009.90 / 0.952 = 5262.50
  const twelveX = calculateChargeAmount(5000, "VCC", 12, constants);
  assertEquals(twelveX.total_with_fees, 5262.5);
  assertEquals(twelveX.installment_amount, 438.54);
});

Deno.test("mirrorRpcChargeAmount returns total_with_fees", () => {
  assertEquals(
    mirrorRpcChargeAmount(1000, "MASTER", 1, PAYMENT_PLATFORM_CONSTANT_DEFAULTS),
    1025.39,
  );
});

Deno.test("calculateChargeAmount rejects invalid installment or rate", () => {
  assertThrows(
    () => calculateChargeAmount(1000, "MASTER", 0, PAYMENT_PLATFORM_CONSTANT_DEFAULTS),
    Error,
    "INVALID_INSTALLMENT_COUNT",
  );
  assertThrows(
    () =>
      calculateChargeAmount(1000, "MASTER", 1, {
        ...PAYMENT_PLATFORM_CONSTANT_DEFAULTS,
        cc_visa_master_1x_rate: 100,
      }),
    Error,
    "INVALID_CARD_FEE_RATE",
  );
});
