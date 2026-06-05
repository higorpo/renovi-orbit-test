const CACHE_TTL_MS = 50 * 60 * 1000;

interface CachedAudioUrl {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CachedAudioUrl>();

export function buildChatAudioDisplayCacheKey(messageId: string, path: string): string {
  return `${messageId}\0${path}`;
}

export function getCachedChatAudioDisplayUrl(cacheKey: string): string | null {
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(cacheKey);
    return null;
  }
  return entry.url;
}

export function setCachedChatAudioDisplayUrl(cacheKey: string, url: string): void {
  cache.set(cacheKey, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}
