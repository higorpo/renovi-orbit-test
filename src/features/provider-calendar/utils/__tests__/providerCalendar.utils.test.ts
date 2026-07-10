import { describe, expect, it } from "vitest";
import type { ScheduledServiceItem } from "../../types/provider-calendar.types";
import { addCalendarDaysIso, enumerateIsoDates } from "@/lib/utils/calendarDate";
import {
  getDayNumberLabel,
  getMonthGridWeeks,
  getMonthYearLabel,
  getWeekdayLabel,
} from "../calendarDateUtils";
import {
  getInitialListRange,
  groupServicesByDay,
  mergeScheduledItems,
  serviceOverlapsDay,
} from "../groupServicesByDay";
import { getSingleDayServicesForCell, layoutWeekBars } from "../layoutWeekBars";

function buildService(overrides: Partial<ScheduledServiceItem> = {}): ScheduledServiceItem {
  return {
    serviceRequestId: "sr-1",
    contractedServiceId: "cs-1",
    title: "Pintura",
    platformServiceTitle: "Pintor",
    platformServiceColorKey: "blue",
    scheduledStartDate: "2026-06-10",
    scheduledEndDate: "2026-06-12",
    scheduledShift: "morning",
    status: "PENDING_PAYMENT",
    ...overrides,
  };
}

describe("groupServicesByDay", () => {
  it("includes multi-day services on each overlapping day", () => {
    const service = buildService();
    const days = groupServicesByDay("2026-06-10", "2026-06-12", [service]);

    expect(days).toHaveLength(3);
    expect(days[0]?.services[0]?.spanPosition).toBe("start");
    expect(days[1]?.services[0]?.spanPosition).toBe("middle");
    expect(days[2]?.services[0]?.spanPosition).toBe("end");
  });

  it("treats same-day services as single-day entries", () => {
    const service = buildService({
      scheduledStartDate: "2026-06-10",
      scheduledEndDate: "2026-06-10",
    });

    const days = groupServicesByDay("2026-06-10", "2026-06-10", [service]);
    expect(days[0]?.services[0]?.spanPosition).toBe("single");
  });

  it("sorts services on a day by scheduled start date", () => {
    const later = buildService({
      contractedServiceId: "cs-later",
      scheduledStartDate: "2026-06-09",
      scheduledEndDate: "2026-06-11",
      title: "Later start",
    });
    const earlier = buildService({
      contractedServiceId: "cs-earlier",
      scheduledStartDate: "2026-06-08",
      scheduledEndDate: "2026-06-11",
      title: "Earlier start",
    });

    const days = groupServicesByDay("2026-06-10", "2026-06-10", [later, earlier]);
    expect(days[0]?.services.map((item) => item.service.contractedServiceId)).toEqual([
      "cs-earlier",
      "cs-later",
    ]);
  });
});

describe("mergeScheduledItems", () => {
  it("deduplicates by contractedServiceId keeping the incoming version", () => {
    const existing = buildService({ title: "Old title" });
    const incoming = buildService({ title: "New title" });

    const merged = mergeScheduledItems([existing], [incoming]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe("New title");
  });

  it("sorts merged items by start date", () => {
    const a = buildService({
      contractedServiceId: "cs-a",
      scheduledStartDate: "2026-06-12",
      scheduledEndDate: "2026-06-12",
    });
    const b = buildService({
      contractedServiceId: "cs-b",
      scheduledStartDate: "2026-06-10",
      scheduledEndDate: "2026-06-10",
    });

    expect(mergeScheduledItems([a], [b]).map((item) => item.contractedServiceId)).toEqual([
      "cs-b",
      "cs-a",
    ]);
  });
});

describe("layoutWeekBars", () => {
  it("creates a spanning bar across multiple days in the same week", () => {
    const service = buildService();
    const week = enumerateIsoDates("2026-06-08", "2026-06-14");
    const bars = layoutWeekBars(week, [service]);

    expect(bars).toHaveLength(1);
    expect(bars[0]?.span).toBeGreaterThan(1);
    expect(bars[0]?.startCol).toBe(2);
  });

  it("marks bars that continue from previous and into next week", () => {
    const service = buildService({
      scheduledStartDate: "2026-06-05",
      scheduledEndDate: "2026-06-16",
    });
    const week = enumerateIsoDates("2026-06-08", "2026-06-14");
    const bars = layoutWeekBars(week, [service]);

    expect(bars).toHaveLength(1);
    expect(bars[0]?.startCol).toBe(0);
    expect(bars[0]?.span).toBe(7);
    expect(bars[0]?.continuesFromPreviousWeek).toBe(true);
    expect(bars[0]?.continuesIntoNextWeek).toBe(true);
  });

  it("places overlapping services on different lanes", () => {
    const first = buildService({
      contractedServiceId: "cs-1",
      title: "Alpha",
      scheduledStartDate: "2026-06-09",
      scheduledEndDate: "2026-06-11",
    });
    const second = buildService({
      contractedServiceId: "cs-2",
      title: "Beta",
      scheduledStartDate: "2026-06-10",
      scheduledEndDate: "2026-06-12",
    });
    const week = enumerateIsoDates("2026-06-08", "2026-06-14");
    const bars = layoutWeekBars(week, [first, second]);

    expect(bars).toHaveLength(2);
    expect(new Set(bars.map((bar) => bar.lane)).size).toBe(2);
  });

  it("sorts same-start services by longer end date then title", () => {
    const shorter = buildService({
      contractedServiceId: "cs-short",
      title: "Zebra",
      scheduledStartDate: "2026-06-10",
      scheduledEndDate: "2026-06-11",
    });
    const longer = buildService({
      contractedServiceId: "cs-long",
      title: "Alpha",
      scheduledStartDate: "2026-06-10",
      scheduledEndDate: "2026-06-13",
    });
    const sameSpanB = buildService({
      contractedServiceId: "cs-b",
      title: "Bravo",
      scheduledStartDate: "2026-06-10",
      scheduledEndDate: "2026-06-11",
    });
    const sameSpanA = buildService({
      contractedServiceId: "cs-a",
      title: "Alpha",
      scheduledStartDate: "2026-06-10",
      scheduledEndDate: "2026-06-11",
    });
    const week = enumerateIsoDates("2026-06-08", "2026-06-14");
    const bars = layoutWeekBars(week, [shorter, longer, sameSpanB, sameSpanA]);

    expect(bars.map((bar) => bar.service.contractedServiceId)).toEqual([
      "cs-long",
      "cs-a",
      "cs-b",
      "cs-short",
    ]);
  });

  it("ignores services outside the week", () => {
    const outside = buildService({
      scheduledStartDate: "2026-06-01",
      scheduledEndDate: "2026-06-03",
    });
    const week = enumerateIsoDates("2026-06-08", "2026-06-14");
    expect(layoutWeekBars(week, [outside])).toEqual([]);
  });
});

describe("getSingleDayServicesForCell", () => {
  it("returns only single-day services that overlap the cell date", () => {
    const single = buildService({
      contractedServiceId: "cs-single",
      scheduledStartDate: "2026-06-10",
      scheduledEndDate: "2026-06-10",
    });
    const multi = buildService({
      contractedServiceId: "cs-multi",
      scheduledStartDate: "2026-06-09",
      scheduledEndDate: "2026-06-11",
    });
    const otherDay = buildService({
      contractedServiceId: "cs-other",
      scheduledStartDate: "2026-06-11",
      scheduledEndDate: "2026-06-11",
    });

    expect(
      getSingleDayServicesForCell("2026-06-10", [single, multi, otherDay]).map(
        (item) => item.contractedServiceId,
      ),
    ).toEqual(["cs-single"]);
  });
});

describe("calendar range helpers", () => {
  it("builds an initial list range centered around today", () => {
    const range = getInitialListRange("2026-06-15");
    expect(range.from).toBe(addCalendarDaysIso("2026-06-15", -7));
    expect(range.to).toBe(addCalendarDaysIso("2026-06-15", 13));
  });

  it("detects overlap for inclusive date ranges", () => {
    const service = buildService();
    expect(serviceOverlapsDay(service, "2026-06-11")).toBe(true);
    expect(serviceOverlapsDay(service, "2026-06-13")).toBe(false);
  });
});

describe("calendarDateUtils", () => {
  it("formats weekday and day number labels in pt-BR", () => {
    expect(getWeekdayLabel("2026-06-10")).toMatch(/quarta/i);
    expect(getDayNumberLabel("2026-06-10")).toBe("10");
  });

  it("returns empty labels for invalid ISO dates", () => {
    expect(getWeekdayLabel("not-a-date")).toBe("");
    expect(getDayNumberLabel("not-a-date")).toBe("");
  });

  it("capitalizes month-year labels", () => {
    const label = getMonthYearLabel(2026, 5);
    expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    expect(label.toLowerCase()).toContain("2026");
  });

  it("builds a Sunday-start month grid covering the full month", () => {
    const weeks = getMonthGridWeeks(2026, 5);
    expect(weeks.length).toBeGreaterThanOrEqual(4);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat()).toContain("2026-06-01");
    expect(weeks.flat()).toContain("2026-06-30");
  });
});
