const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(isoDate: string): Date | null {
  const match = ISO_DATE_RE.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDaysIso(isoDate: string, days: number): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  parsed.setDate(parsed.getDate() + days);
  return toIsoDate(parsed);
}

export function todayIso(): string {
  return toIsoDate(startOfLocalDay(new Date()));
}

export function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isSameIsoDate(a: string, b: string): boolean {
  return a === b;
}

export function isDateInRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

export function getMonthStartIso(year: number, monthIndex: number): string {
  return toIsoDate(new Date(year, monthIndex, 1));
}

export function getMonthEndIso(year: number, monthIndex: number): string {
  return toIsoDate(new Date(year, monthIndex + 1, 0));
}

export function enumerateIsoDates(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return dates;
}

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
      week.push(toIsoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor > monthEnd && cursor.getDay() === 0) break;
  }

  return weeks;
}
