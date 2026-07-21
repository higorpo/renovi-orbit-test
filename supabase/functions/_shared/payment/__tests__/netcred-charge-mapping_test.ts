import { assertEquals, assertThrows } from "std/testing/asserts";
import { mapToNetCredChargeInput } from "../netcred-charge-mapping.ts";
import type { CreateChargeInput } from "../types.ts";

const baseInput: CreateChargeInput = {
  referenceCode: "c4a81f63-2d9e-4b1c-8e7a-1f0d9c8b7a6e",
  amount: "1500.00",
  serviceTitle: "Pintura interna",
  paymentMethod: {
    type: "CREDIT_CARD",
    installmentNumber: 1,
    paymentProfileId: "403137",
    paymentToken: "token",
  },
  payoutRule: {
    providerAccount: {
      netcredCompanyId: "1048",
      netcredBankAccountId: "2053",
    },
    ruleItems: [
      {
        type: "FIXED_AMOUNT",
        receiver: "provider",
        amount: "1200.00",
        isLiable: false,
      },
      {
        type: "PERCENTAGE",
        receiver: "platform",
        percentage: 100,
        isLiable: true,
      },
    ],
  },
  sessionId: "clearsale-session",
};

Deno.test("mapToNetCredChargeInput uses provider companyId and service title", () => {
  const mapped = mapToNetCredChargeInput(baseInput, "2052");

  assertEquals(mapped.companyId, 1048);
  assertEquals(mapped.extraInfo, "Renovi — Pintura interna");
  assertEquals(mapped.orderInput?.orderItems[0].productInput.name, "Pintura interna");
  assertEquals(
    mapped.orderInput?.orderItems[0].productInput.description,
    "Renovi — Pintura interna",
  );
});

Deno.test("mapToNetCredChargeInput falls back when service title is missing", () => {
  const mapped = mapToNetCredChargeInput(
    { ...baseInput, serviceTitle: undefined },
    "2052",
  );

  assertEquals(mapped.extraInfo, "Renovi — Serviço");
  assertEquals(mapped.orderInput?.orderItems[0].productInput.name, "Serviço");
});

Deno.test("mapToNetCredChargeInput rejects unsupported payment method", () => {
  assertThrows(
    () =>
      mapToNetCredChargeInput(
        {
          ...baseInput,
          paymentMethod: { type: "PIX" } as never,
        },
        "2052",
      ),
    Error,
    "UNSUPPORTED_PAYMENT_METHOD",
  );
});

Deno.test("mapToNetCredChargeInput rejects invalid bank account id", () => {
  assertThrows(
    () =>
      mapToNetCredChargeInput(
        {
          ...baseInput,
          payoutRule: {
            ...baseInput.payoutRule,
            providerAccount: {
              netcredCompanyId: "1048",
              netcredBankAccountId: "not-a-number",
            },
          },
        },
        "2052",
      ),
    Error,
    "INVALID_BANK_ACCOUNT_ID:provider",
  );
});

Deno.test("mapToNetCredChargeInput rejects invalid provider company or profile id", () => {
  assertThrows(
    () =>
      mapToNetCredChargeInput(
        {
          ...baseInput,
          payoutRule: {
            ...baseInput.payoutRule,
            providerAccount: {
              netcredCompanyId: "abc",
              netcredBankAccountId: "2053",
            },
          },
        },
        "2052",
      ),
    Error,
    "INVALID_NETCRED_COMPANY_OR_PROFILE_ID",
  );
});

Deno.test("mapToNetCredChargeInput requires percentage and amount on rule items", () => {
  assertThrows(
    () =>
      mapToNetCredChargeInput(
        {
          ...baseInput,
          payoutRule: {
            ...baseInput.payoutRule,
            ruleItems: [
              {
                type: "PERCENTAGE",
                receiver: "platform",
                isLiable: true,
              },
            ],
          },
        },
        "2052",
      ),
    Error,
    "PAYOUT_RULE_PERCENTAGE_REQUIRED",
  );

  assertThrows(
    () =>
      mapToNetCredChargeInput(
        {
          ...baseInput,
          payoutRule: {
            ...baseInput.payoutRule,
            ruleItems: [
              {
                type: "FIXED_AMOUNT",
                receiver: "provider",
                isLiable: false,
                amount: "",
              },
            ],
          },
        },
        "2052",
      ),
    Error,
    "PAYOUT_RULE_AMOUNT_REQUIRED",
  );
});
