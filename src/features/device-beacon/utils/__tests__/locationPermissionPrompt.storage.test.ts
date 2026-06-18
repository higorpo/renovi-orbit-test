import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearLocationPromptSeen,
  clearStoredLocationPermissionGranted,
  getStoredLocationPermissionGranted,
  isLocationPromptSeen,
  LOCATION_PERMISSION_DIALOG_KEY,
  LOCATION_PERMISSION_GRANTED_KEY,
  markLocationPromptSeen,
  setStoredLocationPermissionGranted,
} from '../locationPermissionPrompt.storage'

const prefs = vi.hoisted(() => new Map<string, string>())

vi.mock('@/lib/capacitor/preferencesStorage', () => ({
  preferencesGet: vi.fn(async (key: string) => prefs.get(key) ?? null),
  preferencesSet: vi.fn(async (key: string, value: string) => {
    prefs.set(key, value)
  }),
  preferencesRemove: vi.fn(async (key: string) => {
    prefs.delete(key)
  }),
}))

describe('locationPermissionPrompt.storage', () => {
  beforeEach(() => {
    prefs.clear()
    vi.clearAllMocks()
  })

  it('isLocationPromptSeen returns false when unset', async () => {
    await expect(isLocationPromptSeen()).resolves.toBe(false)
  })

  it('markLocationPromptSeen persists orbit.location_prompt_seen', async () => {
    await markLocationPromptSeen()
    expect(prefs.get(LOCATION_PERMISSION_DIALOG_KEY)).toBe('true')
    await expect(isLocationPromptSeen()).resolves.toBe(true)
  })

  it('clearLocationPromptSeen removes stored value', async () => {
    await markLocationPromptSeen()
    await clearLocationPromptSeen()
    await expect(isLocationPromptSeen()).resolves.toBe(false)
  })

  it('stores and reads location permission granted flag', async () => {
    await setStoredLocationPermissionGranted(true)
    expect(prefs.get(LOCATION_PERMISSION_GRANTED_KEY)).toBe('true')
    await expect(getStoredLocationPermissionGranted()).resolves.toBe(true)

    await setStoredLocationPermissionGranted(false)
    await expect(getStoredLocationPermissionGranted()).resolves.toBe(false)
  })

  it('getStoredLocationPermissionGranted returns null when unset', async () => {
    await expect(getStoredLocationPermissionGranted()).resolves.toBeNull()
  })

  it('clearStoredLocationPermissionGranted removes stored value', async () => {
    await setStoredLocationPermissionGranted(true)
    await clearStoredLocationPermissionGranted()
    await expect(getStoredLocationPermissionGranted()).resolves.toBeNull()
  })
})
