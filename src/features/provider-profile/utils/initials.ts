/** Get initials from full name (e.g. "João Silva" -> "JS"). */
export function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const last = parts[parts.length - 1]?.[0] ?? "";
    return (first + last).toUpperCase().slice(0, 2);
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}
