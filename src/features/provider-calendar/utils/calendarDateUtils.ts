import {
  parseIsoDate,
  toLocalDateOnlyIso,
  startOfLocalDay,
} from "@/lib/utils/calendarDate";

export function getWeekdayLabel(isoDate: string): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return "";
  return parsed.toLocaleDateString("pt-BR", { weekday: "long" });
}

export function getDayNumberLabel(isoDate: string): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return "";
  return String(parsed.getDate());
}

export function getMonthYearLabel(year: number, monthIndex: number): string {
  const label = new Date(year, monthIndex, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function getMonthGridWeeks(year: number, monthIndex: number): string[][] {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const weeks: string[][] = [];
  let cursor = startOfLocalDay(gridStart);

  while (cursor <= monthEnd || cursor.getDay() !== 0) {
    const week: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(toLocalDateOnlyIso(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor > monthEnd && cursor.getDay() === 0) break;
  }

  return weeks;
}
