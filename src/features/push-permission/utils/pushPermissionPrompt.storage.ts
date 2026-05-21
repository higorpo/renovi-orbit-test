import {
  preferencesGet,
  preferencesRemove,
  preferencesSet,
} from '@/lib/capacitor/preferencesStorage'

const STORAGE_KEY = 'orbit_push_permission_prompt_dismissed_at'

/** Cooldown after "Not now" before showing the explanatory dialog again. */
export const PUSH_PERMISSION_PROMPT_DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export async function isPushPermissionPromptDismissed(): Promise<boolean> {
  try {
    const raw = await preferencesGet(STORAGE_KEY)
    if (!raw) return false
    const dismissedAt = new Date(raw).getTime()
    if (Number.isNaN(dismissedAt)) return false
    return Date.now() - dismissedAt < PUSH_PERMISSION_PROMPT_DISMISS_COOLDOWN_MS
  } catch {
    return false
  }
}

export async function markPushPermissionPromptDismissed(): Promise<void> {
  await preferencesSet(STORAGE_KEY, new Date().toISOString())
}

export async function clearPushPermissionPromptDismissed(): Promise<void> {
  await preferencesRemove(STORAGE_KEY)
}
