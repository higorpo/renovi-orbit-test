import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearPushPermissionPromptDismissed,
  isPushPermissionPromptDismissed,
  markPushPermissionPromptDismissed,
  PUSH_PERMISSION_PROMPT_DISMISS_COOLDOWN_MS,
} from '../pushPermissionPrompt.storage'

describe('pushPermissionPrompt.storage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false when never dismissed', () => {
    expect(isPushPermissionPromptDismissed()).toBe(false)
  })

  it('returns true within dismiss cooldown', () => {
    markPushPermissionPromptDismissed()
    expect(isPushPermissionPromptDismissed()).toBe(true)
  })

  it('returns false after cooldown expires', () => {
    markPushPermissionPromptDismissed()
    vi.advanceTimersByTime(PUSH_PERMISSION_PROMPT_DISMISS_COOLDOWN_MS + 1)
    expect(isPushPermissionPromptDismissed()).toBe(false)
  })

  it('clearPushPermissionPromptDismissed removes stored value', () => {
    markPushPermissionPromptDismissed()
    clearPushPermissionPromptDismissed()
    expect(isPushPermissionPromptDismissed()).toBe(false)
  })

  it('returns false when stored date is invalid', () => {
    localStorage.setItem('orbit_push_permission_prompt_dismissed_at', 'invalid-date')
    expect(isPushPermissionPromptDismissed()).toBe(false)
  })

  it('returns false when localStorage read throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(isPushPermissionPromptDismissed()).toBe(false)
    getItem.mockRestore()
  })

})
