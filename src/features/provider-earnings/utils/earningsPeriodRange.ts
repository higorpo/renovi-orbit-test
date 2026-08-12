import {
  addCalendarMonthsIso,
  getMonthStartIso,
  parseIsoDate,
  todayInSaoPauloIso,
} from "@/lib/utils/calendarDate";
import { EARNINGS_PERIOD, type EarningsPeriod } from "../constants/earningsPeriod";

export type EarningsPeriodRange = {
  from: string;
  to: string;
};

/** Inclusive civil dates (YYYY-MM-DD) in America/Sao_Paulo. */
export function getEarningsPeriodRange(
  period: EarningsPeriod,
  now: Date = new Date(),
): EarningsPeriodRange {
  const today = todayInSaoPauloIso(now);

  if (period === EARNINGS_PERIOD.month) {
    const parsed = parseIsoDate(today);
    if (!parsed) return { from: today, to: today };
    return {
      from: getMonthStartIso(parsed.getFullYear(), parsed.getMonth()),
      to: today,
    };
  }

  const months = period === EARNINGS_PERIOD.threeMonths ? -3 : -6;
  return {
    from: addCalendarMonthsIso(today, months),
    to: today,
  };
}
