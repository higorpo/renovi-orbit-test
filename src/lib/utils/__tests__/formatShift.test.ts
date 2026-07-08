import { describe, expect, it } from "vitest";
import { formatShift, formatShiftHighlightSuffix } from "../formatShift";

describe("formatShift", () => {
  it("translates known shifts to lowercase pt-BR labels", () => {
    expect(formatShift("morning")).toBe("manhã");
    expect(formatShift("afternoon")).toBe("tarde");
    expect(formatShift("full_day")).toBe("dia inteiro");
  });

  it("capitalizes labels when requested", () => {
    expect(formatShift("morning", { capitalize: true })).toBe("Manhã");
    expect(formatShift("afternoon", { capitalize: true })).toBe("Tarde");
    expect(formatShift("full_day", { capitalize: true })).toBe("Dia inteiro");
  });

  it("returns unknown shifts unchanged", () => {
    expect(formatShift("night")).toBe("night");
    expect(formatShift("night", { capitalize: true })).toBe("night");
  });

  it("builds highlight suffixes", () => {
    expect(formatShiftHighlightSuffix("morning")).toBe(" · turno da manhã");
    expect(formatShiftHighlightSuffix("full_day")).toBe(" · dia inteiro");
  });
});
