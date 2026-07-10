import { describe, expect, it } from "vitest";
import {
  getComplexityLabel,
  getDurationLabel,
  getUrgencyConfig,
} from "../serviceDetail.constants";

describe("getDurationLabel", () => {
  it("returns null for missing or unknown duration", () => {
    expect(getDurationLabel(null)).toBeNull();
    expect(getDurationLabel(undefined)).toBeNull();
    expect(getDurationLabel("unknown")).toBeNull();
  });

  it("maps known duration keys", () => {
    expect(getDurationLabel("under_1h")).toBe("Menos de 1 hora");
    expect(getDurationLabel("1_day")).toBe("1 dia");
  });
});

describe("getUrgencyConfig", () => {
  it("returns null for missing or unknown urgency", () => {
    expect(getUrgencyConfig(null)).toBeNull();
    expect(getUrgencyConfig(undefined)).toBeNull();
    expect(getUrgencyConfig("critical")).toBeNull();
  });

  it("maps known urgency levels", () => {
    expect(getUrgencyConfig("high")).toEqual({
      label: "Urgente",
      variant: "destructive",
    });
    expect(getUrgencyConfig("medium")?.label).toBe("Média prioridade");
    expect(getUrgencyConfig("low")?.variant).toBe("default");
  });
});

describe("getComplexityLabel", () => {
  it("returns null for missing complexity", () => {
    expect(getComplexityLabel(null)).toBeNull();
    expect(getComplexityLabel(undefined)).toBeNull();
  });

  it("maps known complexity or returns the raw value", () => {
    expect(getComplexityLabel("simple")).toBe("Simples");
    expect(getComplexityLabel("custom")).toBe("custom");
  });
});
