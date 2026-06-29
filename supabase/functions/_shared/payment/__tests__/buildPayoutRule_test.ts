import { assertEquals, assertThrows } from "std/testing/asserts";
import { buildPayoutRule } from "../buildPayoutRule.ts";

const sampleAccount = {
  netcredCompanyId: "1048",
  netcredBankAccountId: "2053",
};

Deno.test("buildPayoutRule matches ADR-0001 canonical split", () => {
  const rule = buildPayoutRule(sampleAccount, "850.00", "1030.00");

  assertEquals(rule.providerAccount, sampleAccount);
  assertEquals(rule.ruleItems.length, 2);
  assertEquals(rule.ruleItems[0], {
    type: "FIXED_AMOUNT",
    receiver: "provider",
    amount: "850.00",
    isLiable: true,
  });
  assertEquals(rule.ruleItems[1], {
    type: "PERCENTAGE",
    receiver: "platform",
    percentage: 100,
    isLiable: true,
  });
});

Deno.test("buildPayoutRule never emits two FIXED_AMOUNT items", () => {
  const rule = buildPayoutRule(sampleAccount, "500.00", "515.00");
  const fixedCount = rule.ruleItems.filter((item) => item.type === "FIXED_AMOUNT").length;
  const percentageCount = rule.ruleItems.filter((item) => item.type === "PERCENTAGE").length;

  assertEquals(fixedCount, 1);
  assertEquals(percentageCount, 1);
});

Deno.test("buildPayoutRule rejects missing NetCred account ids", () => {
  assertThrows(
    () =>
      buildPayoutRule(
        { netcredCompanyId: "", netcredBankAccountId: "2053" },
        "850.00",
        "1030.00",
      ),
    Error,
    "PROVIDER_ACCOUNT_NOT_READY",
  );
});

Deno.test("buildPayoutRule rejects non-numeric amounts", () => {
  assertThrows(
    () => buildPayoutRule(sampleAccount, "not-a-number", "1030.00"),
    Error,
    "INVALID_PAYOUT_AMOUNTS",
  );
});
