import { describe, expect, it } from "vitest";
import {
  estimateProviderBankSettlementDate,
  formatEstimatedBankReceiptDate,
  formatProviderSettlementDisclosure,
  formatProviderSettlementHoldDisclosure,
} from "../providerSettlementDisclosure";

describe("providerSettlementDisclosure", () => {
  it("adds 30 calendar days to capture paid_at", () => {
    const estimated = estimateProviderBankSettlementDate("2026-01-15T12:00:00.000Z");

    expect(estimated).toEqual(new Date(2026, 1, 14));
  });

  it("formats estimated bank receipt date in pt-BR", () => {
    expect(formatEstimatedBankReceiptDate("2026-01-15T12:00:00.000Z")).toBe(
      "14 de fevereiro de 2026",
    );
  });

  it("builds provider disclosure copy with D+30 fallback", () => {
    expect(formatProviderSettlementDisclosure("2026-01-15T12:00:00.000Z")).toBe(
      "Previsão de depósito na conta: 14 de fevereiro de 2026",
    );
  });

  it("prefers real settling_at over D+30 estimate", () => {
    expect(
      formatProviderSettlementDisclosure("2026-01-15T12:00:00.000Z", {
        settlingAt: "2026-03-01",
      }),
    ).toBe("Previsão de depósito na conta: 01 de março de 2026");
  });

  it("falls back to D+30 when settling_at is invalid", () => {
    expect(
      formatProviderSettlementDisclosure("2026-01-15T12:00:00.000Z", {
        settlingAt: "not-a-date",
      }),
    ).toBe("Previsão de depósito na conta: 14 de fevereiro de 2026");
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
