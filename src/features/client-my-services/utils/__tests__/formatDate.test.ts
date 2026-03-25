import { describe, it, expect, vi } from "vitest";
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

  it("returns original string when toLocaleDateString throws", () => {
    const iso = "2025-03-16T12:00:00Z";
    const spy = vi.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(() => {
      throw new Error("locale");
    });
    expect(formatServiceRequestDate(iso)).toBe(iso);
    spy.mockRestore();
  });
});
