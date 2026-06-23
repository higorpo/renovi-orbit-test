const ISO_DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toLocalDateOnlyIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Normalizes civil calendar dates (YYYY-MM-DD) and timestamps to a local ISO date. */
export function normalizeServiceCalendarDateToIso(value: string): string | null {
  const trimmed = value.trim();
  const dateOnly = ISO_DATE_ONLY_RE.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const parsed = new Date(year, month, day);
    if (Number.isNaN(parsed.getTime())) return null;
    return toLocalDateOnlyIso(parsed);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toLocalDateOnlyIso(parsed);
}

export function formatServiceCalendarDate(value: string): string {
  const normalized = normalizeServiceCalendarDateToIso(value);
  if (!normalized) return value;

  const match = ISO_DATE_ONLY_RE.exec(normalized);
  if (!match) return value;

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function todayCalendarIso(): string {
  return toLocalDateOnlyIso(new Date());
}

export function addCalendarDaysIso(isoDate: string, days: number): string {
  const match = ISO_DATE_ONLY_RE.exec(isoDate);
  if (!match) return isoDate;

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) return isoDate;

  parsed.setDate(parsed.getDate() + days);
  return toLocalDateOnlyIso(parsed);
}
