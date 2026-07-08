import type { ContractedServiceSummary } from "../types/service.types";
import { formatShift, formatShiftHighlightSuffix } from "@/lib/utils/formatShift";
import {
  addCalendarDaysIso,
  formatCalendarDate,
  normalizeCalendarDateToIso,
  todayCalendarIso,
} from "@/lib/utils/calendarDate";

export interface ScheduledSummary {
  dateLabel: string;
  shiftLabel: string | null;
}

export function formatScheduledSummary(
  contracted: ContractedServiceSummary,
): ScheduledSummary | null {
  if (!contracted.scheduledStartDate) return null;

  const dateLabel = formatCalendarDate(contracted.scheduledStartDate);
  const shiftLabel = contracted.scheduledShift
    ? formatShift(contracted.scheduledShift)
    : null;

  return { dateLabel, shiftLabel };
}

export type ScheduledTiming = "today" | "tomorrow" | "future" | "past";

export function getScheduledTiming(
  scheduledStartDate: string,
  scheduledEndDate?: string | null,
): ScheduledTiming {
  const startIso = normalizeCalendarDateToIso(scheduledStartDate);
  if (!startIso) return "future";

  const endIso =
    normalizeCalendarDateToIso(scheduledEndDate ?? scheduledStartDate) ?? startIso;
  const rangeStart = startIso <= endIso ? startIso : endIso;
  const rangeEnd = startIso <= endIso ? endIso : startIso;

  const todayIso = todayCalendarIso();
  const tomorrowIso = addCalendarDaysIso(todayIso, 1);

  if (todayIso >= rangeStart && todayIso <= rangeEnd) return "today";
  if (tomorrowIso >= rangeStart && tomorrowIso <= rangeEnd) return "tomorrow";
  if (rangeEnd < todayIso) return "past";
  return "future";
}

export interface ScheduleHighlightContent {
  timing: ScheduledTiming;
  title: string;
}

export function getScheduleHighlightContent(
  contracted: ContractedServiceSummary,
): ScheduleHighlightContent | null {
  const scheduled = formatScheduledSummary(contracted);
  if (!scheduled) return null;

  const timing = getScheduledTiming(
    contracted.scheduledStartDate,
    contracted.scheduledEndDate,
  );
  const shiftPart = contracted.scheduledShift
    ? formatShiftHighlightSuffix(contracted.scheduledShift)
    : "";

  if (timing === "today") return { timing, title: `Serviço hoje${shiftPart}` };
  if (timing === "tomorrow") return { timing, title: `Agendado para amanhã${shiftPart}` };
  return { timing, title: `Agendado para ${scheduled.dateLabel}${shiftPart}` };
}

/** @deprecated Use getScheduleHighlightContent */
export function formatScheduleHighlightTitle(
  contracted: ContractedServiceSummary,
): string | null {
  return getScheduleHighlightContent(contracted)?.title ?? null;
}
