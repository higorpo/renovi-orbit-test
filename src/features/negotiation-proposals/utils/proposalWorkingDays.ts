function parseLocalISODate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Inclusive calendar days between two ISO dates (weekends included). */
export function countInclusiveCalendarDaysISO(startDate: string, endDate: string): number {
  const start = parseLocalISODate(startDate);
  const end = parseLocalISODate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/** Inclusive count of Mon–Fri days between two ISO dates (weekends excluded). */
export function countInclusiveWorkingDaysISO(startDate: string, endDate: string): number {
  const start = parseLocalISODate(startDate);
  const end = parseLocalISODate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (!isWeekend(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Valid when either calendar-day or working-day count matches the informed duration. */
export function matchesProposalDayDurationISO(
  startDate: string,
  endDate: string,
  durationValue: number,
): boolean {
  return (
    countInclusiveCalendarDaysISO(startDate, endDate) === durationValue ||
    countInclusiveWorkingDaysISO(startDate, endDate) === durationValue
  );
}
