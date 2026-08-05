const ISO_DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})/;

/** IANA timezone for Brazil business calendar (BRT / América/São Paulo). */
export const AMERICA_SAO_PAULO_TZ = "America/Sao_Paulo";

/** Formats a Date as a local civil calendar ISO date (YYYY-MM-DD). */
export function toLocalDateOnlyIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses a civil YYYY-MM-DD string into a local Date at midnight. */
export function parseIsoDate(isoDate: string): Date | null {
  const match = ISO_DATE_ONLY_RE.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Extracts the leading civil YYYY-MM-DD from a date-only or ISO timestamp string.
 * Does not convert timezones — use for DB date columns / ISO prefixes.
 */
export function extractDateOnlyIso(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const match = ISO_DATE_PREFIX_RE.exec(value.trim());
  return match?.[1] ?? null;
}

/** Today's calendar date in an IANA timezone as YYYY-MM-DD (`en-CA` → ISO shape). */
export function todayInTimeZoneIso(
  timeZone: string,
  now: Date = new Date(),
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Today's calendar date in America/Sao_Paulo as YYYY-MM-DD. */
export function todayInSaoPauloIso(now: Date = new Date()): string {
  return todayInTimeZoneIso(AMERICA_SAO_PAULO_TZ, now);
}

/** Normalizes civil calendar dates (YYYY-MM-DD) and timestamps to a local ISO date. */
export function normalizeCalendarDateToIso(value: string): string | null {
  const trimmed = value.trim();
  const dateOnly = ISO_DATE_ONLY_RE.exec(trimmed);
  if (dateOnly) {
    const parsed = parseIsoDate(trimmed);
    return parsed ? toLocalDateOnlyIso(parsed) : null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toLocalDateOnlyIso(parsed);
}

/** Formats a calendar date (or timestamp) as pt-BR short date (dd/mm/yyyy). */
export function formatCalendarDate(value: string): string {
  const normalized = normalizeCalendarDateToIso(value);
  if (!normalized) return value;

  const parsed = parseIsoDate(normalized);
  if (!parsed) return value;

  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formats a calendar date (or timestamp) as pt-BR long date (e.g. "14 de fevereiro de 2026"). */
export function formatLongDatePtBr(value: string): string {
  const normalized = normalizeCalendarDateToIso(value);
  if (!normalized) return value;

  const parsed = parseIsoDate(normalized);
  if (!parsed) return value;

  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function todayCalendarIso(): string {
  return toLocalDateOnlyIso(new Date());
}

export function addCalendarDaysIso(isoDate: string, days: number): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;

  parsed.setDate(parsed.getDate() + days);
  return toLocalDateOnlyIso(parsed);
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
  return toLocalDateOnlyIso(new Date(year, monthIndex, 1));
}

export function getMonthEndIso(year: number, monthIndex: number): string {
  return toLocalDateOnlyIso(new Date(year, monthIndex + 1, 0));
}

export function enumerateIsoDates(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addCalendarDaysIso(cursor, 1);
  }
  return dates;
}
