/**
 * Keeps blob preview URLs alive after optimistic rows are replaced by server messages,
 * until signed URLs are resolved and preloaded (avoids flicker on swap).
 */
const holdoverByIdempotencyKey = new Map<string, string[]>();

export function registerImagePreviewHoldover(
  idempotencyKey: string,
  previewUrls: readonly string[],
): void {
  if (previewUrls.length === 0) return;
  holdoverByIdempotencyKey.set(idempotencyKey, [...previewUrls]);
}

export function getImagePreviewHoldover(idempotencyKey: string): string[] | null {
  const urls = holdoverByIdempotencyKey.get(idempotencyKey);
  return urls && urls.length > 0 ? urls : null;
}

export function clearImagePreviewHoldover(idempotencyKey: string): void {
  const urls = holdoverByIdempotencyKey.get(idempotencyKey);
  if (!urls) return;

  for (const url of urls) {
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }
  holdoverByIdempotencyKey.delete(idempotencyKey);
}

/** @internal Test helper */
export function clearAllImagePreviewHoldoversForTests(): void {
  for (const key of holdoverByIdempotencyKey.keys()) {
    clearImagePreviewHoldover(key);
  }
}
