import type { PayoutRuleInput } from "./types.ts";

export type BuildPayoutRuleProviderAccount = {
  netcredCompanyId: string;
  netcredBankAccountId: string;
};

/**
 * Builds NetCred split payload per ADR-0001: provider FIXED_AMOUNT + platform PERCENTAGE 100%
 * of (chargeAmount − providerPayout). NetCred requires at least one PERCENTAGE rule item.
 */
export function buildPayoutRule(
  providerAccount: BuildPayoutRuleProviderAccount,
  providerPayout: string,
  chargeAmount: string,
): PayoutRuleInput {
  const charge = Number.parseFloat(chargeAmount);
  const payout = Number.parseFloat(providerPayout);

  if (
    !Number.isFinite(charge) ||
    !Number.isFinite(payout) ||
    charge <= 0 ||
    payout <= 0 ||
    payout > charge
  ) {
    throw new Error("INVALID_PAYOUT_AMOUNTS");
  }

  const companyId = providerAccount.netcredCompanyId?.trim();
  const bankAccountId = providerAccount.netcredBankAccountId?.trim();
  if (!companyId || !bankAccountId) {
    throw new Error("PROVIDER_ACCOUNT_NOT_READY");
  }

  const providerFixed = Math.round(payout * 100) / 100;

  return {
    providerAccount: {
      netcredCompanyId: companyId,
      netcredBankAccountId: bankAccountId,
    },
    ruleItems: [
      {
        type: "FIXED_AMOUNT",
        receiver: "provider",
        amount: providerFixed.toFixed(2),
        isLiable: true,
      },
      {
        type: "PERCENTAGE",
        receiver: "platform",
        percentage: 100,
        isLiable: true,
      },
    ],
  };
}
