/**
 * Normalizes a string for accent-insensitive, case-insensitive search.
 * Uses NFD to decompose accents and removes combining marks (e.g. á -> a).
 */
export function normalizeForSearch(s: string): string {
  if (!s || typeof s !== "string") return "";
  return s
    .normalize("NFD")
    .replace(/\p{Mn}|\p{Mc}|\p{Me}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Returns true if `haystack` contains `needle` when both are normalized
 * (accents and case ignored).
 */
export function normalizedIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const n = normalizeForSearch(needle);
  if (!n) return true;
  return normalizeForSearch(haystack).includes(n);
}
