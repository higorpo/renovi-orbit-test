/**
 * Formats an ISO timestamp (or date string) as a pt-BR short date (dd/mm/yyyy).
 * Prefer `formatCalendarDate` for civil YYYY-MM-DD calendar dates.
 */
export function formatDatePtBr(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}
