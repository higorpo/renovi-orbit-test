import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getPersistSession } from '@/features/auth/utils/persistSession'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY
// const isProduction = import.meta.env.PROD

/** Anon key used for Edge Function calls when user is not logged in (same as client). */
export function getSupabaseAnonKey(): string {
  if (typeof supabaseAnonKey !== "string" || !supabaseAnonKey) {
    throw new Error("VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY is not set");
  }
  return supabaseAnonKey;
}

// Expose storage key for E2E so seedSession can use the same key (avoids .env mismatch)
const supabaseStorageKey =
  typeof supabaseUrl === "string" && supabaseUrl.startsWith("http")
    ? `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`
    : ""
if (typeof window !== "undefined" && supabaseStorageKey) {
  ;(window as unknown as { __E2E_SUPABASE_STORAGE_KEY__?: string }).__E2E_SUPABASE_STORAGE_KEY__ =
    supabaseStorageKey
}

/** Storage that uses localStorage when "remember me" is on, sessionStorage otherwise (logout on browser close). */
function createAuthStorage(): Storage {
  return {
    getItem(key: string): string | null {
      const backend = getPersistSession() ? localStorage : sessionStorage
      return backend.getItem(key)
    },
    setItem(key: string, value: string): void {
      const backend = getPersistSession() ? localStorage : sessionStorage
      backend.setItem(key, value)
    },
    removeItem(key: string): void {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    },
    key(index: number): string | null {
      const backend = getPersistSession() ? localStorage : sessionStorage
      return backend.key(index)
    },
    get length(): number {
      const backend = getPersistSession() ? localStorage : sessionStorage
      return backend.length
    },
    clear(): void {
      const backend = getPersistSession() ? localStorage : sessionStorage
      backend.clear()
    },
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createAuthStorage(),
    debug: false,
  }
})