/**
 * Format profile created_at for "Cliente desde {date}" display.
 */

export function formatClientSince(createdAt: string | null | undefined): string {
  if (!createdAt) return "";
  try {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "";
    const month = date.toLocaleDateString("pt-BR", { month: "long" });
    const year = date.getFullYear();
    return `${month}/${year}`;
  } catch {
    return "";
  }
}
