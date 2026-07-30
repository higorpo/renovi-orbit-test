import { describe, expect, it } from "vitest";
import {
  formatEstimatedBankReceiptDate,
  formatProviderSettlementDisclosure,
  formatProviderSettlementHoldDisclosure,
  estimateProviderBankSettlementDate,
} from "../providerSettlementDisclosure";

describe("providerSettlementDisclosure", () => {
  it("adds 30 days to capture paid_at in UTC", () => {
    const estimated = estimateProviderBankSettlementDate("2026-01-15T12:00:00.000Z");

    expect(estimated?.toISOString()).toBe("2026-02-14T12:00:00.000Z");
  });

  it("formats estimated bank receipt date in pt-BR", () => {
    expect(formatEstimatedBankReceiptDate("2026-01-15T12:00:00.000Z")).toBe("14 de fevereiro de 2026");
  });

  it("builds provider disclosure copy", () => {
    expect(formatProviderSettlementDisclosure("2026-01-15T12:00:00.000Z")).toBe(
      "Previsão de depósito na conta: 14 de fevereiro de 2026",
    );
  });

  it("returns null for invalid dates", () => {
    expect(estimateProviderBankSettlementDate("invalid")).toBeNull();
    expect(formatEstimatedBankReceiptDate("invalid")).toBeNull();
    expect(formatProviderSettlementDisclosure("invalid")).toBeNull();
  });

  it("describes refund hold suspending bank deposit estimate", () => {
    expect(formatProviderSettlementHoldDisclosure()).toContain("estorno");
    expect(formatProviderSettlementHoldDisclosure("refund")).toContain(
      "previsão de depósito fica suspensa",
    );
  });

  it("describes dispute hold suspending bank deposit estimate", () => {
    expect(formatProviderSettlementHoldDisclosure("dispute")).toContain("chargeback");
    expect(formatProviderSettlementHoldDisclosure("dispute")).toContain("disputa");
  });
});
