import { describe, expect, it } from "vitest";
import {
  buildRescheduleProposedSlot,
  deriveRescheduleDateMode,
  isRescheduleDateRangeMode,
  isRescheduleSlotDateRange,
} from "../deriveRescheduleDateMode";

describe("deriveRescheduleDateMode", () => {
  it("treats hourly services as single-day", () => {
    expect(deriveRescheduleDateMode("hours", 8)).toBe("single_day");
  });

  it("treats multi-day services as date range", () => {
    expect(deriveRescheduleDateMode("days", 3)).toBe("date_range");
  });

  it("does not treat days with value below 2 as a date range", () => {
    expect(deriveRescheduleDateMode("days", 1)).toBe("single_day");
  });

  it("exposes isRescheduleDateRangeMode as a boolean helper", () => {
    expect(isRescheduleDateRangeMode("days", 3)).toBe(true);
    expect(isRescheduleDateRangeMode("hours", 8)).toBe(false);
  });
});

describe("buildRescheduleProposedSlot", () => {
  it("omits end_date for hourly services and embeds duration", () => {
    expect(
      buildRescheduleProposedSlot({
        startDate: "2030-06-10",
        endDate: "2030-06-12",
        shift: "morning",
        durationUnit: "hours",
        durationValue: 4,
      }),
    ).toEqual({
      start_date: "2030-06-10",
      end_date: null,
      shift: "morning",
      duration_unit: "hours",
      duration_value: 4,
    });
  });

  it("keeps the informed end_date for multi-day services", () => {
    expect(
      buildRescheduleProposedSlot({
        startDate: "2030-06-10",
        endDate: "2030-06-12",
        shift: "full_day",
        durationUnit: "days",
        durationValue: 3,
      }),
    ).toEqual({
      start_date: "2030-06-10",
      end_date: "2030-06-12",
      shift: "full_day",
      duration_unit: "days",
      duration_value: 3,
    });
  });
});

describe("isRescheduleSlotDateRange", () => {
  it("is false when end_date is missing or equals start", () => {
    expect(isRescheduleSlotDateRange({ start_date: "2030-06-10", end_date: null })).toBe(false);
    expect(
      isRescheduleSlotDateRange({ start_date: "2030-06-10", end_date: "2030-06-10" }),
    ).toBe(false);
  });

  it("is true when end_date differs from start", () => {
    expect(
      isRescheduleSlotDateRange({ start_date: "2030-06-10", end_date: "2030-06-12" }),
    ).toBe(true);
  });
});
