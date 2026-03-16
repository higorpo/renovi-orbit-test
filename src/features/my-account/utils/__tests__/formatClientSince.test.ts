import { describe, it, expect } from "vitest";
import { formatClientSince } from "../formatClientSince";

describe("formatClientSince", () => {
  it("returns empty string for null", () => {
    expect(formatClientSince(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatClientSince(undefined)).toBe("");
  });

  it("formats ISO date as month/year in pt-BR", () => {
    expect(formatClientSince("2024-03-15T12:00:00Z")).toMatch(/março\/2024|March\/2024/i);
  });

  it("returns empty string for invalid date", () => {
    expect(formatClientSince("not-a-date")).toBe("");
  });
});
