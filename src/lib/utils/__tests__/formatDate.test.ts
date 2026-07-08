import { describe, expect, it } from "vitest";
import { formatDatePtBr } from "../formatDate";

describe("formatDatePtBr", () => {
  it("formats ISO timestamps as pt-BR short dates", () => {
    expect(formatDatePtBr("2024-03-15T12:00:00Z")).toMatch(/\d{2}\/\d{2}\/2024/);
  });

  it("returns the original value for invalid dates", () => {
    expect(formatDatePtBr("not-a-date")).toBe("not-a-date");
  });
});
