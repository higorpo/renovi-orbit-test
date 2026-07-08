import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { proposeRescheduleFormSchema } from "../../types/serviceReschedule.forms";

describe("proposeRescheduleFormSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 5, 1, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not require endDate for hourly services", () => {
    const result = proposeRescheduleFormSchema.safeParse({
      startDate: "2030-06-10",
      endDate: "",
      shift: "morning",
      durationUnit: "hours",
      durationValueInput: "4",
    });

    expect(result.success).toBe(true);
  });

  it("rejects hourly duration above 24", () => {
    expect(
      proposeRescheduleFormSchema.safeParse({
        startDate: "2030-06-10",
        endDate: "",
        shift: "morning",
        durationUnit: "hours",
        durationValueInput: "25",
      }).success,
    ).toBe(false);
  });

  it("requires endDate and duration match for multi-day services", () => {
    expect(
      proposeRescheduleFormSchema.safeParse({
        startDate: "2030-06-10",
        endDate: "",
        shift: "morning",
        durationUnit: "days",
        durationValueInput: "3",
      }).success,
    ).toBe(false);

    expect(
      proposeRescheduleFormSchema.safeParse({
        startDate: "2030-06-10",
        endDate: "2030-06-11",
        shift: "morning",
        durationUnit: "days",
        durationValueInput: "3",
      }).success,
    ).toBe(false);

    // Fri–Tue spans 3 working days (weekend excluded).
    expect(
      proposeRescheduleFormSchema.safeParse({
        startDate: "2030-06-14",
        endDate: "2030-06-18",
        shift: "full_day",
        durationUnit: "days",
        durationValueInput: "3",
      }).success,
    ).toBe(true);
  });

  it("does not require endDate for 1-day day-based services", () => {
    expect(
      proposeRescheduleFormSchema.safeParse({
        startDate: "2030-06-10",
        endDate: "",
        shift: "afternoon",
        durationUnit: "days",
        durationValueInput: "1",
      }).success,
    ).toBe(true);
  });

  it("allows switching from days to hours without endDate", () => {
    expect(
      proposeRescheduleFormSchema.safeParse({
        startDate: "2030-06-10",
        endDate: "",
        shift: "morning",
        durationUnit: "hours",
        durationValueInput: "6",
      }).success,
    ).toBe(true);
  });
});
