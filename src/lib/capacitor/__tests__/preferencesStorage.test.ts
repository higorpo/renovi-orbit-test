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
})
