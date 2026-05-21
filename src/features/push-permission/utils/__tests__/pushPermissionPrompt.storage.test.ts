import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '@/lib/capacitor/__tests__/preferencesStorage.harness'
import { preferencesGet } from '@/lib/capacitor/preferencesStorage'
import {
  clearPushPermissionPromptDismissed,
  isPushPermissionPromptDismissed,
  markPushPermissionPromptDismissed,
  PUSH_PERMISSION_PROMPT_DISMISS_COOLDOWN_MS,
} from '../pushPermissionPrompt.storage'

describe('pushPermissionPrompt.storage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false when never dismissed', async () => {
    await expect(isPushPermissionPromptDismissed()).resolves.toBe(false)
  })

  it('returns true within dismiss cooldown', async () => {
    await markPushPermissionPromptDismissed()
    await expect(isPushPermissionPromptDismissed()).resolves.toBe(true)
  })

  it('returns false after cooldown expires', async () => {
    await markPushPermissionPromptDismissed()
    vi.advanceTimersByTime(PUSH_PERMISSION_PROMPT_DISMISS_COOLDOWN_MS + 1)
    await expect(isPushPermissionPromptDismissed()).resolves.toBe(false)
  })

  it('clearPushPermissionPromptDismissed removes stored value', async () => {
    await markPushPermissionPromptDismissed()
    await clearPushPermissionPromptDismissed()
    await expect(isPushPermissionPromptDismissed()).resolves.toBe(false)
  })

  it('returns false when stored date is invalid', async () => {
    const { preferencesSet } = await import('@/lib/capacitor/preferencesStorage')
    await preferencesSet('orbit_push_permission_prompt_dismissed_at', 'invalid-date')
    await expect(isPushPermissionPromptDismissed()).resolves.toBe(false)
  })

  it('returns false when preferences read throws', async () => {
    vi.mocked(preferencesGet).mockRejectedValueOnce(new Error('blocked'))
    await expect(isPushPermissionPromptDismissed()).resolves.toBe(false)
  })
})
