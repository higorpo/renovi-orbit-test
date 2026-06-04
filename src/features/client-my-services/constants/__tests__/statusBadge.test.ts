import { describe, expect, it } from "vitest";
import { getStatusBadgeVariant, getStatusLabel } from "../statusBadge";

describe("getStatusBadgeVariant", () => {
  it("returns secondary for negotiation without proposals", () => {
    expect(getStatusBadgeVariant("negotiation", 0)).toBe("secondary");
  });

  it("returns warning for negotiation with proposals", () => {
    expect(getStatusBadgeVariant("negotiation", 1)).toBe("warning");
  });

  it("returns phase variants for other tabs", () => {
    expect(getStatusBadgeVariant("in_progress", 0)).toBe("default");
    expect(getStatusBadgeVariant("completed", 0)).toBe("success");
    expect(getStatusBadgeVariant("cancelled", 0)).toBe("secondary");
  });
});

describe("getStatusLabel", () => {
  it("shows awaiting decision when negotiation has pending proposal", () => {
    expect(getStatusLabel("negotiation", true)).toBe("Aguardando decisão");
  });

  it("shows phase label otherwise", () => {
    expect(getStatusLabel("in_progress")).toBe("Em andamento");
  });
});
