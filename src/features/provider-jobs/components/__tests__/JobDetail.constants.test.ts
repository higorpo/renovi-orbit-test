import { describe, expect, it } from "vitest";
import {
  getComplexityLabel,
  getDurationLabel,
  getProposalStatusLabel,
  getUrgencyConfig,
  SUGGESTED_ITEMS_TOOLTIP_TEXT,
} from "../JobDetail.constants";

describe("JobDetail.constants", () => {
  it("resolves duration labels for known keys", () => {
    expect(getDurationLabel("1_day")).toBe("1 dia");
    expect(getDurationLabel(null)).toBeNull();
    expect(getDurationLabel("unknown")).toBeNull();
  });

  it("resolves urgency config", () => {
    expect(getUrgencyConfig("high")).toEqual({
      label: "Urgente",
      variant: "destructive",
    });
    expect(getUrgencyConfig(null)).toBeNull();
    expect(getUrgencyConfig("other")).toBeNull();
  });

  it("resolves complexity labels", () => {
    expect(getComplexityLabel("simple")).toBe("Simples");
    expect(getComplexityLabel("custom")).toBe("custom");
    expect(getComplexityLabel(null)).toBeNull();
  });

  it("normalizes proposal status labels", () => {
    expect(getProposalStatusLabel("ACCEPTED")).toBe("Aceito pelo cliente");
    expect(getProposalStatusLabel(null)).toBe(
      "Aguardando avaliação do cliente",
    );
    expect(getProposalStatusLabel("unknown")).toBe(
      "Aguardando avaliação do cliente",
    );
  });

  it("exposes tooltip copy", () => {
    expect(SUGGESTED_ITEMS_TOOLTIP_TEXT.length).toBeGreaterThan(20);
  });
});
