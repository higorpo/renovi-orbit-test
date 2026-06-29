import type { CreateChargeInput, CreditCardCharge } from "./types.ts";

export type NetCredScheduleInput = {
  scheduleType: "DAILY";
  scheduleAnchor: number;
  automaticAdvance: false;
};

export type NetCredPayoutRuleItem = {
  splitType: "FIXED_AMOUNT" | "PERCENTAGE";
  amount?: string;
  proportion?: string;
  isLiable: boolean;
  bankAccountId: number;
  scheduleInput: NetCredScheduleInput;
};

export type NetCredChargeCreateInput = {
  companyId: number;
  paymentProfileId: number;
  amount: string;
  referenceCode: string;
  installmentNumber: number;
  billDaysInAdvance: number;
  manualCapture: false;
  customerIpAddress?: string;
  orderInput?: {
    sessionId?: string;
    referenceCode: string;
    orderItems: Array<{
      productInput: {
        name: string;
        amount: string;
        category: string;
      };
    }>;
  };
  payoutRuleInput: {
    name: string;
    persist: false;
    isPrimary: false;
    ruleItems: NetCredPayoutRuleItem[];
  };
};

const DEFAULT_SCHEDULE_INPUT: NetCredScheduleInput = {
  scheduleType: "DAILY",
  scheduleAnchor: 1,
  automaticAdvance: false,
};

function assertCreditCardCharge(
  input: CreateChargeInput,
): CreditCardCharge {
  if (input.paymentMethod.type !== "CREDIT_CARD") {
    throw new Error("UNSUPPORTED_PAYMENT_METHOD");
  }
  return input.paymentMethod;
}

function resolveBankAccountId(
  input: CreateChargeInput,
  receiver: "provider" | "platform",
  platformBankAccountId: string,
): number {
  const raw = receiver === "provider"
    ? input.payoutRule.providerAccount.netcredBankAccountId
    : platformBankAccountId;

  const bankAccountId = Number.parseInt(raw, 10);
  if (!Number.isFinite(bankAccountId)) {
    throw new Error(`INVALID_BANK_ACCOUNT_ID:${receiver}`);
  }
  return bankAccountId;
}

export function mapToNetCredChargeInput(
  input: CreateChargeInput,
  platformBankAccountId: string,
): NetCredChargeCreateInput {
  const paymentMethod = assertCreditCardCharge(input);
  const companyId = Number.parseInt(
    input.payoutRule.providerAccount.netcredCompanyId,
    10,
  );
  const paymentProfileId = Number.parseInt(paymentMethod.paymentProfileId, 10);

  if (!Number.isFinite(companyId) || !Number.isFinite(paymentProfileId)) {
    throw new Error("INVALID_NETCRED_COMPANY_OR_PROFILE_ID");
  }

  const ruleItems: NetCredPayoutRuleItem[] = input.payoutRule.ruleItems.map(
    (item) => {
      const mapped: NetCredPayoutRuleItem = {
        splitType: item.type,
        isLiable: item.isLiable,
        bankAccountId: resolveBankAccountId(
          input,
          item.receiver,
          platformBankAccountId,
        ),
        scheduleInput: DEFAULT_SCHEDULE_INPUT,
      };

      if (item.type === "PERCENTAGE") {
        if (item.percentage === undefined) {
          throw new Error("PAYOUT_RULE_PERCENTAGE_REQUIRED");
        }
        mapped.proportion = item.percentage.toFixed(1);
      } else {
        if (!item.amount) {
          throw new Error("PAYOUT_RULE_AMOUNT_REQUIRED");
        }
        mapped.amount = item.amount;
      }

      return mapped;
    },
  );

  const chargeInput: NetCredChargeCreateInput = {
    companyId,
    paymentProfileId,
    amount: input.amount,
    referenceCode: input.referenceCode,
    installmentNumber: paymentMethod.installmentNumber,
    billDaysInAdvance: 0,
    manualCapture: false,
    payoutRuleInput: {
      name: `Renovi split ${input.referenceCode}`,
      persist: false,
      isPrimary: false,
      ruleItems,
    },
  };

  if (input.customerIpAddress) {
    chargeInput.customerIpAddress = input.customerIpAddress;
  }

  if (input.sessionId) {
    chargeInput.orderInput = {
      sessionId: input.sessionId,
      referenceCode: input.referenceCode,
      orderItems: [{
        productInput: {
          name: "Renovi contracted service",
          amount: input.amount,
          category: "Serviços",
        },
      }],
    };
  }

  return chargeInput;
}
