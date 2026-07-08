import type { ServiceRescheduleSlot } from "../types/serviceReschedule.types";

/** Whether the reschedule UI should collect a date range or a single execution date. */
export type RescheduleDateMode = "single_day" | "date_range";

/**
 * Date-mode from the duration currently being proposed (or contracted baseline).
 * Hourly and 1-day services stay single-day; multi-day (duration_value > 1) requires a range.
 */
export function deriveRescheduleDateMode(
  durationUnit: string | null | undefined,
  durationValue: number | null | undefined,
): RescheduleDateMode {
  if (durationUnit === "days" && typeof durationValue === "number" && durationValue > 1) {
    return "date_range";
  }
  return "single_day";
}

export function isRescheduleDateRangeMode(
  durationUnit: string | null | undefined,
  durationValue: number | null | undefined,
): boolean {
  return deriveRescheduleDateMode(durationUnit, durationValue) === "date_range";
}

/** True when a stored slot should be communicated as a multi-day range. */
export function isRescheduleSlotDateRange(
  slot: Pick<ServiceRescheduleSlot, "start_date" | "end_date"> | null | undefined,
): boolean {
  return Boolean(slot?.end_date && slot.end_date !== slot.start_date);
}

/**
 * Builds the slot payload for propose/accept persistence.
 * Hours → end_date null; days → end_date always set (equals start for single-day).
 * Duration is embedded so accept can update contracted_services.
 */
export function buildRescheduleProposedSlot(input: {
  startDate: string;
  endDate: string;
  shift: ServiceRescheduleSlot["shift"];
  durationUnit: "hours" | "days";
  durationValue: number;
}): ServiceRescheduleSlot {
  const startDate = input.startDate.trim();
  const shift = input.shift;
  const dateMode = deriveRescheduleDateMode(input.durationUnit, input.durationValue);
  const duration = {
    duration_unit: input.durationUnit,
    duration_value: input.durationValue,
  };

  if (input.durationUnit === "hours") {
    return { start_date: startDate, end_date: null, shift, ...duration };
  }

  if (dateMode === "single_day") {
    return { start_date: startDate, end_date: startDate, shift, ...duration };
  }

  return {
    start_date: startDate,
    end_date: input.endDate.trim() || null,
    shift,
    ...duration,
  };
}
