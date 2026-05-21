import { beforeEach, describe, expect, it, vi } from 'vitest'

const preferencesMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
}))

vi.mock('@capacitor/preferences', () => ({
  Preferences: preferencesMocks,
}))

import {
  createSupabaseAuthStorage,
  preferencesClear,
  preferencesGet,
  preferencesRemove,
  preferencesSet,
} from '../preferencesStorage'

describe('preferencesStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    preferencesMocks.get.mockResolvedValue({ value: 'stored' })
    preferencesMocks.set.mockResolvedValue(undefined)
    preferencesMocks.remove.mockResolvedValue(undefined)
    preferencesMocks.clear.mockResolvedValue(undefined)
  })

  it('preferencesGet returns value from Preferences.get', async () => {
    await expect(preferencesGet('session')).resolves.toBe('stored')
    expect(preferencesMocks.get).toHaveBeenCalledWith({ key: 'session' })
  })

  it('preferencesGet returns null when value is null', async () => {
    preferencesMocks.get.mockResolvedValue({ value: null })
    await expect(preferencesGet('missing')).resolves.toBeNull()
  })

  it('preferencesSet delegates to Preferences.set', async () => {
    await preferencesSet('k', 'v')
    expect(preferencesMocks.set).toHaveBeenCalledWith({ key: 'k', value: 'v' })
  })

  it('preferencesRemove delegates to Preferences.remove', async () => {
    await preferencesRemove('k')
    expect(preferencesMocks.remove).toHaveBeenCalledWith({ key: 'k' })
  })

  it('preferencesClear delegates to Preferences.clear', async () => {
    await preferencesClear()
    expect(preferencesMocks.clear).toHaveBeenCalledTimes(1)
  })

  describe('createSupabaseAuthStorage', () => {
    it('persists auth token via Preferences when remember-me is on', async () => {
      const storage = createSupabaseAuthStorage(() => true)
      await storage.setItem('sb-test-auth-token', '{"access_token":"a"}')
      expect(preferencesMocks.set).toHaveBeenCalledWith({
        key: 'sb-test-auth-token',
        value: '{"access_token":"a"}',
      })
      await expect(storage.getItem('sb-test-auth-token')).resolves.toBe('stored')
    })

    it('keeps auth token in memory only when remember-me is off', async () => {
      const storage = createSupabaseAuthStorage(() => false)
      await storage.setItem('sb-test-auth-token', '{"access_token":"b"}')
      expect(preferencesMocks.set).not.toHaveBeenCalled()
      await expect(storage.getItem('sb-test-auth-token')).resolves.toBe('{"access_token":"b"}')
    })

    it('removeItem clears both persistent and ephemeral stores', async () => {
      const storage = createSupabaseAuthStorage(() => false)
      await storage.setItem('sb-test-auth-token', 'x')
      await storage.removeItem('sb-test-auth-token')
      expect(preferencesMocks.remove).toHaveBeenCalledWith({ key: 'sb-test-auth-token' })
      await expect(storage.getItem('sb-test-auth-token')).resolves.toBeNull()
    })
  })
})
