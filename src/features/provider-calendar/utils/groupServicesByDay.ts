import type {
  CalendarDayEntry,
  ScheduledServiceDayItem,
  ScheduledServiceItem,
} from "../types/provider-calendar.types";
import {
  addCalendarDaysIso,
  compareIsoDates,
  enumerateIsoDates,
  isSameIsoDate,
  todayCalendarIso,
} from "@/lib/utils/calendarDate";

function getSpanPosition(
  day: string,
  service: ScheduledServiceItem,
): ScheduledServiceDayItem["spanPosition"] {
  const start = service.scheduledStartDate;
  const end = service.scheduledEndDate;
  if (isSameIsoDate(start, end)) return "single";
  if (isSameIsoDate(day, start)) return "start";
  if (isSameIsoDate(day, end)) return "end";
  return "middle";
}

export function serviceOverlapsDay(service: ScheduledServiceItem, day: string): boolean {
  return service.scheduledStartDate <= day && service.scheduledEndDate >= day;
}

export function groupServicesByDay(
  from: string,
  to: string,
  services: ScheduledServiceItem[],
): CalendarDayEntry[] {
  const dates = enumerateIsoDates(from, to);
  return dates.map((date) => ({
    date,
    services: services
      .filter((service) => serviceOverlapsDay(service, date))
      .map((service) => ({
        service,
        spanPosition: getSpanPosition(date, service),
      }))
      .sort((a, b) => compareIsoDates(a.service.scheduledStartDate, b.service.scheduledStartDate)),
  }));
}

export function mergeScheduledItems(
  existing: ScheduledServiceItem[],
  incoming: ScheduledServiceItem[],
): ScheduledServiceItem[] {
  const map = new Map<string, ScheduledServiceItem>();
  for (const item of existing) {
    map.set(item.contractedServiceId, item);
  }
  for (const item of incoming) {
    map.set(item.contractedServiceId, item);
  }
  return Array.from(map.values()).sort((a, b) =>
    compareIsoDates(a.scheduledStartDate, b.scheduledStartDate),
  );
}

export function getInitialListRange(today = todayCalendarIso()): { from: string; to: string } {
  return {
    from: addCalendarDaysIso(today, -7),
    to: addCalendarDaysIso(today, 13),
  };
}
