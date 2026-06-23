import { describe, expect, it } from "vitest";
import {
  formatServiceCalendarDate,
  normalizeServiceCalendarDateToIso,
  toLocalDateOnlyIso,
} from "../serviceCalendarDate";

describe("serviceCalendarDate", () => {
  it("keeps civil YYYY-MM-DD dates in the local calendar", () => {
    expect(normalizeServiceCalendarDateToIso("2026-06-24")).toBe("2026-06-24");
    expect(formatServiceCalendarDate("2026-06-24")).toBe("24/06/2026");
  });

  it("normalizes timestamps to the local calendar day", () => {
    const normalized = normalizeServiceCalendarDateToIso("2026-06-24T03:00:00.000Z");
    expect(normalized).toBe(
      toLocalDateOnlyIso(new Date("2026-06-24T03:00:00.000Z")),
    );
  });
});
