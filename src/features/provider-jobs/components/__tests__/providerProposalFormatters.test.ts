import { describe, expect, it } from "vitest";
import {
  formatProposalCurrency,
  formatProposalDateOnly,
  formatProposalDateTime,
  translateProposalShift,
  translateProposalStatus,
} from "../providerProposalFormatters";

describe("providerProposalFormatters", () => {
  it("formats currency in BRL", () => {
    expect(formatProposalCurrency(1234.56)).toMatch(/1\.234,56/);
  });

  it("formats date-time and handles invalid input", () => {
    expect(formatProposalDateTime("2026-03-20T15:30:00.000Z")).not.toBe(
      "Data indisponível",
    );
    expect(formatProposalDateTime(null)).toBe("Data indisponível");
    expect(formatProposalDateTime("not-a-date")).toBe("Data indisponível");
  });

  it("formats date-only strings", () => {
    expect(formatProposalDateOnly("2026-03-20")).not.toBe("Data indisponível");
    expect(formatProposalDateOnly(null)).toBe("Data indisponível");
  });

  it("translates proposal status via JobDetail.constants", () => {
    expect(translateProposalStatus("withdrawn")).toBe("Orçamento retirado");
  });

  it("translates shift values", () => {
    expect(translateProposalShift("morning")).toBe("Manhã");
    expect(translateProposalShift("afternoon")).toBe("Tarde");
    expect(translateProposalShift("full_day")).toBe("Dia inteiro");
    expect(translateProposalShift("custom")).toBe("custom");
  });

});
