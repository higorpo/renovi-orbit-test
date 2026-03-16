import { describe, it, expect } from "vitest";
import { formatServiceRequestDate } from "../formatDate";

describe("formatServiceRequestDate", () => {
  it("formats ISO date to pt-BR short date", () => {
    expect(formatServiceRequestDate("2025-03-16T12:00:00Z")).toMatch(
      /\d{2}\/\d{2}\/\d{4}/
    );
  });

  it("returns original string for invalid date", () => {
    const invalid = "not-a-date";
    expect(formatServiceRequestDate(invalid)).toBe(invalid);
  });
});
