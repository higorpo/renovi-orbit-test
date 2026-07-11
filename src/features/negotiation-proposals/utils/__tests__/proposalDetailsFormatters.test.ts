import { describe, expect, it } from "vitest";
import {
  formatProposalDateOnly,
  formatProposalDateTime,
  getProposalStatusLabel,
  translateProposalShift,
} from "../proposalDetailsFormatters";

describe("getProposalStatusLabel", () => {
  it.each([
    ["PENDING", "Aguardando resposta"],
    ["REJECTED_AUTOMATICALLY", "Recusada automaticamente"],
    ["REVISED", "Atualizada"],
  ])("translates status %s", (status, expected) => {
    expect(getProposalStatusLabel(status)).toBe(expected);
  });

  it("returns fallbacks for missing and unknown statuses", () => {
    expect(getProposalStatusLabel(null)).toBe("Desconhecido");
    expect(getProposalStatusLabel("CUSTOM_STATUS")).toBe("CUSTOM_STATUS");
  });
});

describe("proposal date formatting", () => {
  it("formats a valid timestamp in pt-BR", () => {
    const formatted = formatProposalDateTime("2026-07-10T12:30:00");

    expect(formatted).toContain("10/07/2026");
    expect(formatted).toContain("12:30");
  });

  it.each([null, undefined, "", "not-a-date"])(
    "returns an unavailable label for invalid timestamp %j",
    (value) => {
      expect(formatProposalDateTime(value)).toBe("Data indisponível");
    },
  );

  it("formats calendar dates without shifting their day", () => {
    expect(formatProposalDateOnly("2026-07-10")).toBe("10/07/2026");
    expect(formatProposalDateOnly("2026-07-10T23:30:00.000Z")).toBe("10/07/2026");
  });

  it.each([null, undefined, "", "invalid"])(
    "returns an unavailable label for invalid calendar date %j",
    (value) => {
      expect(formatProposalDateOnly(value)).toBe("Data indisponível");
    },
  );
});

describe("translateProposalShift", () => {
  it.each([
    ["morning", "Manhã"],
    ["afternoon", "Tarde"],
    ["full_day", "Dia inteiro"],
    ["overnight", "overnight"],
  ])("translates shift %s", (shift, expected) => {
    expect(translateProposalShift(shift)).toBe(expected);
  });
});
