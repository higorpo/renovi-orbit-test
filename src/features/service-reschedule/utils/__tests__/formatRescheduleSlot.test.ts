import { describe, expect, it } from "vitest";
import { formatRescheduleSlot } from "../formatRescheduleSlot";

describe("formatRescheduleSlot", () => {
  it("returns empty string when slot is missing or has no start_date", () => {
    expect(formatRescheduleSlot(null)).toBe("");
    expect(formatRescheduleSlot(undefined)).toBe("");
    expect(formatRescheduleSlot({ start_date: "", shift: "morning" })).toBe("");
  });

  it("formats a single-day slot with shift label", () => {
    const label = formatRescheduleSlot({
      start_date: "2030-06-10",
      end_date: null,
      shift: "morning",
    });

    expect(label).toContain("manhã");
    expect(label).not.toContain("até");
  });

  it("formats a multi-day range when end_date differs from start", () => {
    const label = formatRescheduleSlot({
      start_date: "2030-06-10",
      end_date: "2030-06-12",
      shift: "full_day",
    });

    expect(label).toContain("até");
  });

  it("treats end_date equal to start_date as a single day", () => {
    const label = formatRescheduleSlot({
      start_date: "2030-06-10",
      end_date: "2030-06-10",
      shift: "afternoon",
    });

    expect(label).not.toContain("até");
  });
});
