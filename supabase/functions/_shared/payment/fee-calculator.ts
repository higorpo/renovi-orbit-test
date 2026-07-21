import type { PlatformConstants, PaymentPlatformConstantKey } from "./constants.ts";

export type ChargeAmountBreakdown = {
  installment_number: number;
  applicable_rate_pct: number;
  total_with_fees: number;
  installment_amount: number;
};

export function resolveRateKey(cardBrand: string, installmentNumber: number): string {
  const brand = cardBrand.toUpperCase();
  const isVisaMaster = brand === "VCC" || brand === "MASTER";

  if (isVisaMaster && installmentNumber === 1) {
    return "cc_visa_master_1x_rate";
  }
  if (isVisaMaster && installmentNumber >= 2 && installmentNumber <= 6) {
    return "cc_visa_master_2_6x_rate";
  }
  if (isVisaMaster && installmentNumber >= 7 && installmentNumber <= 12) {
    return "cc_visa_master_7_12x_rate";
  }
  if (installmentNumber === 1) {
    return "cc_elo_other_1x_rate";
  }
  if (installmentNumber >= 2 && installmentNumber <= 6) {
    return "cc_elo_other_2_6x_rate";
  }
  if (installmentNumber >= 7 && installmentNumber <= 12) {
    return "cc_elo_other_7_12x_rate";
  }
  return "cc_elo_other_1x_rate";
}

export function bankersRound(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const truncated = Math.trunc(scaled);
  const remainder = Math.abs(scaled - truncated);

  if (Math.abs(remainder - 0.5) > Number.EPSILON) {
    return Math.round(scaled) / factor;
  }

  const evenTruncated = truncated % 2 === 0
    ? truncated
    : truncated + (scaled >= 0 ? 1 : -1);
  return evenTruncated / factor;
}

/** Mirrors PostgreSQL `round(numeric, scale)` (half away from zero). */
export function postgresRound(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  return Math.sign(scaled) * Math.round(Math.abs(scaled)) / factor;
}

/**
 * TEST-ONLY / parity helper.
 *
 * Charge-authoritative fee math lives in PostgreSQL (`payment_total_with_card_fees`).
 * This TypeScript mirror exists for Edge unit tests and local parity checks only —
 * do not use it to authorize production charge amounts (CHK-040 / CHK-042d).
 */
export function calculateChargeAmount(
  baseAmount: number,
  cardBrand: string,
  installmentNumber: number,
  constants: PlatformConstants,
  rounding: "bankers" | "postgres" = "bankers",
): ChargeAmountBreakdown {
  if (installmentNumber < 1 || installmentNumber > 12) {
    throw new Error("INVALID_INSTALLMENT_COUNT");
  }

  const roundFn = rounding === "postgres" ? postgresRound : bankersRound;
  const rateKey = resolveRateKey(cardBrand, installmentNumber);
  const applicableRatePct = constants[rateKey as PaymentPlatformConstantKey];

  if (
    !Number.isFinite(applicableRatePct) ||
    applicableRatePct < 0 ||
    applicableRatePct >= 100
  ) {
    throw new Error("INVALID_CARD_FEE_RATE");
  }

  const fixedFees =
    constants.cc_fixed_processing_fee_brl + constants.cc_risk_analysis_fee_brl;
  const totalWithFees = roundFn(
    (baseAmount + fixedFees) / (1 - applicableRatePct / 100),
    2,
  );
  const installmentAmount = roundFn(totalWithFees / installmentNumber, 2);

  return {
    installment_number: installmentNumber,
    applicable_rate_pct: applicableRatePct,
    total_with_fees: totalWithFees,
    installment_amount: installmentAmount,
  };
}

export function computeInstallmentOptions(
  baseAmount: number,
  cardBrand: string,
  constants: PlatformConstants,
): ChargeAmountBreakdown[] {
  const options: ChargeAmountBreakdown[] = [];

  for (let installmentNumber = 1; installmentNumber <= 12; installmentNumber += 1) {
    options.push(calculateChargeAmount(baseAmount, cardBrand, installmentNumber, constants));
  }

  return options;
}

export function mirrorRpcChargeAmount(
  baseAmount: number,
  cardBrand: string,
  installmentNumber: number,
  constants: PlatformConstants,
): number {
  return calculateChargeAmount(
    baseAmount,
    cardBrand,
    installmentNumber,
    constants,
    "bankers",
  ).total_with_fees;
}
