import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { createSupabaseAuthStorage } from '@/lib/capacitor/preferencesStorage'
import { getPersistSession } from '@/lib/persistSession'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY

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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createSupabaseAuthStorage(getPersistSession),
    debug: false,
  }
})
