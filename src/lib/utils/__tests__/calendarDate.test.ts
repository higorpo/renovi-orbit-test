import { describe, expect, it } from "vitest";
import {
  addCalendarDaysIso,
  formatCalendarDate,
  formatLongDatePtBr,
  normalizeCalendarDateToIso,
  parseIsoDate,
  toLocalDateOnlyIso,
  todayCalendarIso,
} from "../calendarDate";

describe("calendarDate", () => {
  it("keeps civil YYYY-MM-DD dates in the local calendar", () => {
    expect(normalizeCalendarDateToIso("2026-06-24")).toBe("2026-06-24");
    expect(formatCalendarDate("2026-06-24")).toBe("24/06/2026");
    expect(formatLongDatePtBr("2026-06-24")).toBe("24 de junho de 2026");
    expect(parseIsoDate("2026-06-24")).toEqual(new Date(2026, 5, 24));
  });

  it("normalizes timestamps to the local calendar day", () => {
    const normalized = normalizeCalendarDateToIso("2026-06-24T03:00:00.000Z");
    expect(normalized).toBe(
      toLocalDateOnlyIso(new Date("2026-06-24T03:00:00.000Z")),
    );
  });

  it("adds calendar days without timezone drift", () => {
    expect(addCalendarDaysIso("2026-06-24", 1)).toBe("2026-06-25");
    expect(addCalendarDaysIso("2026-06-30", 1)).toBe("2026-07-01");
  });

  it("returns today as local ISO date", () => {
    expect(todayCalendarIso()).toBe(toLocalDateOnlyIso(new Date()));
  });
});
