import { describe, expect, it } from "vitest";
import type { ScheduledServiceItem } from "../types/provider-calendar.types";
import { addCalendarDaysIso, enumerateIsoDates } from "@/lib/utils/calendarDate";
import { getInitialListRange, groupServicesByDay, serviceOverlapsDay } from "../groupServicesByDay";
import { layoutWeekBars } from "../layoutWeekBars";

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
