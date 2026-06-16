import type { ContractedServiceSummary } from "../types/service.types";
import { formatServiceDate } from "./formatDate";
import { formatShift, formatShiftHighlightSuffix } from "./formatShift";

export interface ScheduledSummary {
  dateLabel: string;
  shiftLabel: string | null;
}

export function formatScheduledSummary(
  contracted: ContractedServiceSummary,
): ScheduledSummary | null {
  if (!contracted.scheduledStartDate) return null;

  const dateLabel = formatServiceDate(contracted.scheduledStartDate);
  const shiftLabel = contracted.scheduledShift
    ? formatShift(contracted.scheduledShift)
    : null;

  return { dateLabel, shiftLabel };
}

export type ScheduledTiming = "today" | "tomorrow" | "future" | "past";

export function getScheduledTiming(scheduledStartDate: string): ScheduledTiming {
  const scheduled = parseLocalDate(scheduledStartDate);
  if (!scheduled) return "future";

  const today = startOfLocalDay(new Date());
  const scheduledDay = startOfLocalDay(scheduled);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (scheduledDay.getTime() === today.getTime()) return "today";
  if (scheduledDay.getTime() === tomorrow.getTime()) return "tomorrow";
  if (scheduledDay.getTime() < today.getTime()) return "past";
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

  const timing = getScheduledTiming(contracted.scheduledStartDate);
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

function parseLocalDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
