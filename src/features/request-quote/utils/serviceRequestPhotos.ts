/**
 * Helpers for service request photos (storage paths or legacy full URLs).
 */

/** True if the value looks like a storage path (no scheme), not a full URL. */
export function isStoragePath(item: string): boolean {
  return (
    item.length > 0 &&
    !item.startsWith("http://") &&
    !item.startsWith("https://")
  );
}
