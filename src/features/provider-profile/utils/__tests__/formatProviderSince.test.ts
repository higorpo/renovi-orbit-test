import { describe, it, expect } from "vitest";
import { formatProviderSince } from "../formatProviderSince";

describe("formatProviderSince", () => {
  it("returns empty for null/undefined", () => {
    expect(formatProviderSince(null)).toBe("");
    expect(formatProviderSince(undefined)).toBe("");
  });

  it("formats valid ISO date", () => {
    const result = formatProviderSince("2024-03-15T12:00:00Z");
    expect(result).toMatch(/No ar desde .*\/2024/);
  });

  it("returns empty for invalid date", () => {
    expect(formatProviderSince("not-a-date")).toBe("");
  });
});
