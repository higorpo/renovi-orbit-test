/**
 * BRT calendar helpers for EXECUTED temporal gates (Req 11 / design §5.4.1).
 */

import { extractDateOnlyIso, todayInSaoPauloIso } from "@/lib/utils/calendarDate";

export type ExecutedTemporalGate = {
  /** BRT today < scheduled_start_date → block EXECUTED (drafts OK). */
  notYetDue: boolean;
  brtToday: string;
};

export function deriveExecutedTemporalGate(input: {
  scheduledStartDate: string | null | undefined;
  scheduledEndDate?: string | null | undefined;
  now?: Date;
}): ExecutedTemporalGate {
  const brtToday = todayInSaoPauloIso(input.now);
  const start = extractDateOnlyIso(input.scheduledStartDate);

  if (!start) {
    return {
      notYetDue: false,
      brtToday,
    };
  }

  return {
    notYetDue: brtToday < start,
    brtToday,
  };
}
