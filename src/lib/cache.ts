/**
 * In-memory TTL cache ({@link cacheGet} / {@link cacheSet}) plus optional
 * {@link cachePersist*} helpers (Capacitor Preferences) for the same logical keys when
 * data must survive reloads (e.g. profile for offline route guards).
 */

import { preferencesGet, preferencesRemove, preferencesSet } from '@/lib/capacitor/preferencesStorage'

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

/** Prefix for values written by cachePersist* (survives reload; use for offline fallbacks). */
const PERSIST_STORAGE_PREFIX = "orbit.cache.persist.v1:";

function persistStorageKey(logicalKey: string): string {
  return PERSIST_STORAGE_PREFIX + logicalKey;
}

/**
 * Read a value previously stored with {@link cachePersistSet}.
 * Same logical `key` as {@link cacheGet} / {@link cacheSet} (e.g. `profile_${userId}`).
 */
export async function cachePersistGet<T>(logicalKey: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = await preferencesGet(persistStorageKey(logicalKey));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cachePersistSet<T>(logicalKey: string, data: T): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await preferencesSet(persistStorageKey(logicalKey), JSON.stringify(data));
  } catch {
    // quota / private mode
  }
}

export async function cachePersistRemove(logicalKey: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await preferencesRemove(persistStorageKey(logicalKey));
  } catch {
    // ignore
  }
}
