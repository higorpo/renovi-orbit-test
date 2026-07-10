import { describe, expect, it } from "vitest";
import { getStatusBadgeVariant, getStatusLabel } from "../statusBadge";

describe("getStatusLabel", () => {
  it("returns awaiting decision when negotiation has a pending proposal", () => {
    expect(getStatusLabel("negotiation", true)).toBe("Aguardando decisão");
  });

  it("returns phase label otherwise", () => {
    expect(getStatusLabel("negotiation", false)).toBe("Em negociação");
    expect(getStatusLabel("in_progress")).toBe("Em andamento");
    expect(getStatusLabel("completed")).toBe("Concluído");
    expect(getStatusLabel("cancelled")).toBe("Cancelado");
  });
});

describe("getStatusBadgeVariant", () => {
  it("uses secondary when negotiation has zero proposals", () => {
    expect(getStatusBadgeVariant("negotiation", 0)).toBe("secondary");
    expect(getStatusBadgeVariant("negotiation")).toBe("secondary");
  });

  it("uses phase variant when negotiation has proposals", () => {
    expect(getStatusBadgeVariant("negotiation", 2)).toBe("warning");
  });

  it("maps other phases to their badge variants", () => {
    expect(getStatusBadgeVariant("in_progress")).toBe("default");
    expect(getStatusBadgeVariant("completed")).toBe("success");
    expect(getStatusBadgeVariant("cancelled")).toBe("secondary");
  });
});
