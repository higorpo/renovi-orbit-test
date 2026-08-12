/**
 * Format profile created_at for "Cliente desde {date}" display.
 */
import { formatMonthYear } from "@/lib/utils/formatMonthYear";

export function formatClientSince(createdAt: string | null | undefined): string {
  return formatMonthYear(createdAt);
}
