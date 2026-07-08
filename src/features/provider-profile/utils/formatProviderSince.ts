/**
 * Format provider "since" date for display (e.g. "No ar desde mar/2024").
 */
import { formatMonthYear } from "@/lib/utils/formatMonthYear";

export function formatProviderSince(createdAt: string | null | undefined): string {
  const monthYear = formatMonthYear(createdAt, { month: "short" });
  if (!monthYear) return "";
  return `No ar desde ${monthYear}`;
}
