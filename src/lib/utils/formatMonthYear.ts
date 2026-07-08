export type FormatMonthYearOptions = {
  /** Default: "long" (e.g. "março"). Use "short" for "mar". */
  month?: "long" | "short";
};

/**
 * Formats a timestamp as "{month}/{year}" in pt-BR (e.g. "março/2024").
 * Returns "" for null, undefined, or invalid dates.
 */
export function formatMonthYear(
  value: string | null | undefined,
  options?: FormatMonthYearOptions,
): string {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const month = date.toLocaleDateString("pt-BR", {
      month: options?.month ?? "long",
    });
    const year = date.getFullYear();
    return `${month}/${year}`;
  } catch {
    return "";
  }
}
