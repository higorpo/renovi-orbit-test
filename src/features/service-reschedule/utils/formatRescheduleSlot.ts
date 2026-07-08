import type { ServiceRescheduleSlot } from "../types/serviceReschedule.types";
import { formatCalendarDate } from "@/lib/utils/calendarDate";
import { formatShift } from "@/lib/utils/formatShift";

export function formatRescheduleSlot(slot: ServiceRescheduleSlot | null | undefined): string {
  if (!slot?.start_date) return "";

  const shiftLabel = formatShift(slot.shift);
  const startLabel = formatCalendarDate(slot.start_date);

  if (slot.end_date && slot.end_date !== slot.start_date) {
    return `${startLabel} até ${formatCalendarDate(slot.end_date)} (${shiftLabel})`;
  }

  return `${startLabel} (${shiftLabel})`;
}
