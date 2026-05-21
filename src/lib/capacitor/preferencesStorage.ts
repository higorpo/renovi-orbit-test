import { Preferences } from '@capacitor/preferences'
import type { SupportedStorage } from '@supabase/auth-js'

/** Web fallback prefix used by @capacitor/preferences (group CapacitorStorage). */
export const PREFERENCES_WEB_KEY_PREFIX = 'CapacitorStorage.'

const sessionOnlyStore: Record<string, string> = {}

function createSessionOnlyStorage(): SupportedStorage {
  return {
    getItem: async (key) => sessionOnlyStore[key] ?? null,
    setItem: async (key, value) => {
      sessionOnlyStore[key] = value
    },
    removeItem: async (key) => {
      delete sessionOnlyStore[key]
    },
  }
}

const ephemeralAuthStorage = createSessionOnlyStorage()

export async function preferencesGet(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key })
  return value
}

export async function preferencesSet(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value })
}

export async function preferencesRemove(key: string): Promise<void> {
  await Preferences.remove({ key })
}

export async function preferencesClear(): Promise<void> {
  await Preferences.clear()
}

/** Maps a logical key to the raw localStorage key on web (for E2E seeding). */
export function toCapacitorPreferencesWebKey(key: string): string {
  return `${PREFERENCES_WEB_KEY_PREFIX}${key}`
}

/**
 * Supabase auth storage backed by Capacitor Preferences when "remember me" is on,
 * or in-memory storage when the session should not survive app restarts.
 */
export function createSupabaseAuthStorage(getPersistSession: () => boolean): SupportedStorage {
  return {
    getItem: async (key) => {
      if (getPersistSession()) {
        return preferencesGet(key)
      }
      return ephemeralAuthStorage.getItem(key)
    },
    setItem: async (key, value) => {
      if (getPersistSession()) {
        await preferencesSet(key, value)
        await ephemeralAuthStorage.removeItem(key)
        return
      }
      await ephemeralAuthStorage.setItem(key, value)
      await preferencesRemove(key)
    },
    removeItem: async (key) => {
      await preferencesRemove(key)
      await ephemeralAuthStorage.removeItem(key)
    },
  }
}
