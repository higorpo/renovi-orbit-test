/**
 * Format provider "since" date for display (e.g. "No ar desde mar/2024").
 */
export function formatProviderSince(createdAt: string | null | undefined): string {
  if (!createdAt) return "";
  try {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "";
    const month = date.toLocaleDateString("pt-BR", { month: "short" });
    const year = date.getFullYear();
    return `No ar desde ${month}/${year}`;
  } catch {
    return "";
  }
}
