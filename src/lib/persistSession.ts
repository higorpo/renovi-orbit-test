import { preferencesGet, preferencesSet } from '@/lib/capacitor/preferencesStorage'

/**
 * Persist session preference for auth storage.
 * When true, session is stored in Capacitor Preferences (survives app restarts).
 * When false, session is kept in memory only (cleared when the app process ends).
 */
const PERSIST_SESSION_KEY = 'orbit_persist_session'

let cachedPersistSession: boolean | null = null

export async function hydratePersistSessionPreference(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const raw = await preferencesGet(PERSIST_SESSION_KEY)
    cachedPersistSession = raw === null ? true : raw === 'true'
  } catch {
    cachedPersistSession = true
  }
}

export function getPersistSession(): boolean {
  if (cachedPersistSession !== null) return cachedPersistSession
  return true
}

export function setPersistSession(value: boolean): void {
  cachedPersistSession = value
  if (typeof window === 'undefined') return
  void preferencesSet(PERSIST_SESSION_KEY, value ? 'true' : 'false')
}
