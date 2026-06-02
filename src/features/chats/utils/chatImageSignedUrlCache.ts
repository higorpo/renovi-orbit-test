const CACHE_TTL_MS = 50 * 60 * 1000;

interface CacheEntry {
  urls: string[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function buildChatImageDisplayCacheKey(
  messageId: string,
  paths: readonly string[],
): string {
  return `${messageId}\0${paths.join("\0")}`;
}

export function getCachedChatImageDisplayUrls(cacheKey: string): string[] | null {
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey);
    return null;
  }
  return entry.urls;
}

export function setCachedChatImageDisplayUrls(cacheKey: string, urls: string[]): void {
  if (urls.length === 0) return;
  cache.set(cacheKey, { urls, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** @internal Test helper */
export function clearChatImageSignedUrlCacheForTests(): void {
  cache.clear();
}
