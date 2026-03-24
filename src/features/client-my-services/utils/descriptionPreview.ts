const DEFAULT_MAX_LINES = 3;
const DEFAULT_MAX_LENGTH = 160;

/**
 * Build a short description preview for cards (2–3 lines, truncated).
 */
export function toDescriptionPreview(
  description: string | null | undefined,
  maxLength: number = DEFAULT_MAX_LENGTH
): string {
  if (description == null || description.trim() === "") return "";
  const trimmed = description.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trimEnd() + "…";
}

export { DEFAULT_MAX_LINES, DEFAULT_MAX_LENGTH };
