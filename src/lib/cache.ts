interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const memory = new Map<string, CacheEntry<unknown>>();

function isStale<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.timestamp > entry.ttlMs;
}

export async function cacheGet<T>(
  key: string,
  _fallbackFn?: () => Promise<T>,
  _ttlMs?: number
): Promise<T | null> {
  const entry = memory.get(key) as CacheEntry<T> | undefined;
  if (!entry || isStale(entry)) return null;
  return entry.data as T;
}

export function cacheSet<T>(
  key: string,
  data: T,
  ttlMs: number = 5 * 60 * 1000
): void {
  memory.set(key, {
    data,
    timestamp: Date.now(),
    ttlMs,
  });
}

export function cacheRemove(key: string): void {
  memory.delete(key);
}
