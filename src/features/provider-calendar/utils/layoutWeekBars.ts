import type { ScheduledServiceItem, WeekEventBar } from "../types/provider-calendar.types";
import { compareIsoDates } from "@/lib/utils/calendarDate";
import { serviceOverlapsDay } from "./groupServicesByDay";

function serviceOverlapsWeek(service: ScheduledServiceItem, weekDates: string[]): boolean {
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  return service.scheduledStartDate <= weekEnd && service.scheduledEndDate >= weekStart;
}

function computeBarSpan(
  service: ScheduledServiceItem,
  weekDates: string[],
): Pick<WeekEventBar, "startCol" | "span" | "continuesFromPreviousWeek" | "continuesIntoNextWeek"> {
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  let startCol = 0;
  let endCol = 6;

  for (let i = 0; i < weekDates.length; i += 1) {
    if (weekDates[i] === service.scheduledStartDate || service.scheduledStartDate < weekStart) {
      startCol = service.scheduledStartDate < weekStart ? 0 : i;
      break;
    }
  }

  for (let i = weekDates.length - 1; i >= 0; i -= 1) {
    if (weekDates[i] === service.scheduledEndDate || service.scheduledEndDate > weekEnd) {
      endCol = service.scheduledEndDate > weekEnd ? 6 : i;
      break;
    }
  }

  return {
    startCol,
    span: endCol - startCol + 1,
    continuesFromPreviousWeek: service.scheduledStartDate < weekStart,
    continuesIntoNextWeek: service.scheduledEndDate > weekEnd,
  };
}

export function layoutWeekBars(
  weekDates: string[],
  services: ScheduledServiceItem[],
): WeekEventBar[] {
  const weekServices = services
    .filter((service) => serviceOverlapsWeek(service, weekDates))
    .sort((a, b) => {
      const startDiff = compareIsoDates(a.scheduledStartDate, b.scheduledStartDate);
      if (startDiff !== 0) return startDiff;
      const endDiff = compareIsoDates(b.scheduledEndDate, a.scheduledEndDate);
      if (endDiff !== 0) return endDiff;
      return a.title.localeCompare(b.title, "pt-BR");
    });

  const lanes: WeekEventBar[][] = [];
  const bars: WeekEventBar[] = [];

  for (const service of weekServices) {
    const span = computeBarSpan(service, weekDates);
    let laneIndex = 0;

    while (true) {
      const lane = lanes[laneIndex] ?? [];
      const overlaps = lane.some((existing) => {
        const existingEnd = existing.startCol + existing.span - 1;
        const nextEnd = span.startCol + span.span - 1;
        return !(existingEnd < span.startCol || existing.startCol > nextEnd);
      });

      if (!overlaps) {
        const bar: WeekEventBar = { service, lane: laneIndex, ...span };
        lanes[laneIndex] = [...lane, bar];
        bars.push(bar);
        break;
      }
      laneIndex += 1;
    }
  }

  return bars;
}

export function getSingleDayServicesForCell(
  date: string,
  services: ScheduledServiceItem[],
): ScheduledServiceItem[] {
  return services.filter(
    (service) =>
      serviceOverlapsDay(service, date) &&
      service.scheduledStartDate === service.scheduledEndDate,
  );
}
