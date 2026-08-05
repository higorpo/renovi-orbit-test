/**
 * BRT calendar helpers for EXECUTED temporal gates (Req 11 / design §5.4.1).
 */

import {
  addCalendarDaysIso,
  extractDateOnlyIso,
  todayInSaoPauloIso,
} from "@/lib/utils/calendarDate";

export type ExecutedTemporalGate = {
  /** BRT today < scheduled_start_date → block EXECUTED (drafts OK). */
  notYetDue: boolean;
  /** BRT today > coalesce(end, start) + 1 → executed_late will be true. */
  willBeLate: boolean;
  brtToday: string;
  onTimeCeiling: string | null;
};

export function deriveExecutedTemporalGate(input: {
  scheduledStartDate: string | null | undefined;
  scheduledEndDate?: string | null | undefined;
  now?: Date;
}): ExecutedTemporalGate {
  const brtToday = todayInSaoPauloIso(input.now);
  const start = extractDateOnlyIso(input.scheduledStartDate);
  const end = extractDateOnlyIso(input.scheduledEndDate) ?? start;

  if (!start || !end) {
    return {
      notYetDue: false,
      willBeLate: false,
      brtToday,
      onTimeCeiling: null,
    };
  }

  const onTimeCeiling = addCalendarDaysIso(end, 1);
  return {
    notYetDue: brtToday < start,
    willBeLate: brtToday > onTimeCeiling,
    brtToday,
    onTimeCeiling,
  };
}
