import { describe, expect, it } from "vitest";
import {
  addCalendarDaysIso,
  addCalendarMonthsIso,
  extractDateOnlyIso,
  formatCalendarDate,
  formatLongDatePtBr,
  normalizeCalendarDateToIso,
  parseIsoDate,
  toLocalDateOnlyIso,
  todayCalendarIso,
  todayInSaoPauloIso,
  todayInTimeZoneIso,
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
    expect(addCalendarDaysIso("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("adds calendar months and clamps the day", () => {
    expect(addCalendarMonthsIso("2026-08-12", -3)).toBe("2026-05-12");
    expect(addCalendarMonthsIso("2026-08-12", -6)).toBe("2026-02-12");
    expect(addCalendarMonthsIso("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("returns today as local ISO date", () => {
    expect(todayCalendarIso()).toBe(toLocalDateOnlyIso(new Date()));
  });

  it("extracts leading YYYY-MM-DD without timezone conversion", () => {
    expect(extractDateOnlyIso("2026-08-10")).toBe("2026-08-10");
    expect(extractDateOnlyIso("2026-08-10T15:00:00.000Z")).toBe("2026-08-10");
    expect(extractDateOnlyIso(" 2026-08-10 ")).toBe("2026-08-10");
    expect(extractDateOnlyIso(null)).toBeNull();
    expect(extractDateOnlyIso("not-a-date")).toBeNull();
  });

  it("returns today in America/Sao_Paulo as YYYY-MM-DD", () => {
    const now = new Date("2026-08-03T15:00:00.000Z"); // BRT 12:00 Aug 3
    expect(todayInSaoPauloIso(now)).toBe("2026-08-03");
    expect(todayInTimeZoneIso("America/Sao_Paulo", now)).toBe("2026-08-03");
  });
});
