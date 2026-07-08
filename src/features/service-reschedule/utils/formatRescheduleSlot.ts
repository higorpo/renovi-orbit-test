import type { ServiceRescheduleSlot } from "../types/serviceReschedule.types";
import { formatServiceCalendarDate } from "@/features/view-services/utils/serviceCalendarDate";
import { formatShift } from "@/features/view-services/utils/formatShift";

export function formatRescheduleSlot(slot: ServiceRescheduleSlot | null | undefined): string {
  if (!slot?.start_date) return "";

  const shiftLabel = formatShift(slot.shift);
  const startLabel = formatServiceCalendarDate(slot.start_date);

  if (slot.end_date && slot.end_date !== slot.start_date) {
    return `${startLabel} até ${formatServiceCalendarDate(slot.end_date)} (${shiftLabel})`;
  }

  return `${startLabel} (${shiftLabel})`;
}
