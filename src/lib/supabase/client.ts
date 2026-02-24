import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getPersistSession } from '@/features/auth/utils/persistSession'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY
const isProduction = import.meta.env.PROD

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
    debug: !isProduction,
  }
})