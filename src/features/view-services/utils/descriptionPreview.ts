export function toDescriptionPreview(
  description: string | null | undefined,
  maxLength = 160,
): string {
  if (description == null || description.trim() === "") return "";
  const trimmed = description.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}
