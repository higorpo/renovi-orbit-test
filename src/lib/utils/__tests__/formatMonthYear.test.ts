import { describe, expect, it } from "vitest";
import { formatMonthYear } from "../formatMonthYear";

describe("formatMonthYear", () => {
  it("returns empty string for nullish or invalid values", () => {
    expect(formatMonthYear(null)).toBe("");
    expect(formatMonthYear(undefined)).toBe("");
    expect(formatMonthYear("not-a-date")).toBe("");
  });

  it("formats with long month by default", () => {
    expect(formatMonthYear("2024-03-15T12:00:00Z")).toMatch(/março\/2024|March\/2024/i);
  });

  it("formats with short month when requested", () => {
    expect(formatMonthYear("2024-03-15T12:00:00Z", { month: "short" })).toMatch(
      /mar\.?\/2024|Mar\.?\/2024/i,
    );
  });
});
