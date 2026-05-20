const STORAGE_KEY = 'orbit_push_permission_prompt_dismissed_at'

/** Cooldown after "Not now" before showing the explanatory dialog again. */
export const PUSH_PERMISSION_PROMPT_DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function isPushPermissionPromptDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const dismissedAt = new Date(raw).getTime()
    if (Number.isNaN(dismissedAt)) return false
    return Date.now() - dismissedAt < PUSH_PERMISSION_PROMPT_DISMISS_COOLDOWN_MS
  } catch {
    return false
  }
}

export function markPushPermissionPromptDismissed(): void {
  localStorage.setItem(STORAGE_KEY, new Date().toISOString())
}

export function clearPushPermissionPromptDismissed(): void {
  localStorage.removeItem(STORAGE_KEY)
}
