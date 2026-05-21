import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '@/lib/capacitor/__tests__/preferencesStorage.harness'
import { clearPreferencesTestStore, getPreferencesTestStore } from '@/lib/capacitor/__tests__/preferencesStorage.harness'
import { DEVICE_BEACON_SYNC_INTERVAL_MS } from '../../types/deviceBeacon.types'
import {
  getDeviceBeaconSyncSnapshot,
  removeDeviceBeaconSyncSnapshot,
  saveDeviceBeaconSyncSnapshot,
  shouldSyncDeviceBeacon,
} from '../syncSchedule'

const basePayload = {
  profile_id: 'profile-1',
  device_id: 'device-1',
  fcm_token: 'token-a',
  push_enabled: true,
  platform: 'web',
  operating_system: null,
  os_version: null,
  manufacturer: null,
  model: null,
  web_view_version: null,
  device_name: null,
  is_virtual: false,
  android_sdk_version: null,
  ios_version: null,
}

describe('syncSchedule', () => {
  beforeEach(() => {
    clearPreferencesTestStore()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saveDeviceBeaconSyncSnapshot and getDeviceBeaconSyncSnapshot round-trip', async () => {
    const snapshot = await saveDeviceBeaconSyncSnapshot(basePayload)
    expect(snapshot.profileId).toBe('profile-1')
    expect(await getDeviceBeaconSyncSnapshot('profile-1', 'device-1')).toEqual(snapshot)
  })

  it('removeDeviceBeaconSyncSnapshot clears entry', async () => {
    await saveDeviceBeaconSyncSnapshot(basePayload)
    await removeDeviceBeaconSyncSnapshot('profile-1', 'device-1')
    expect(await getDeviceBeaconSyncSnapshot('profile-1', 'device-1')).toBeNull()
  })

  it('shouldSyncDeviceBeacon returns true when forced', async () => {
    const snapshot = await saveDeviceBeaconSyncSnapshot(basePayload)
    expect(shouldSyncDeviceBeacon(snapshot, basePayload, true)).toBe(true)
  })

  it('shouldSyncDeviceBeacon returns true without snapshot', () => {
    expect(shouldSyncDeviceBeacon(null, basePayload, false)).toBe(true)
  })

  it('shouldSyncDeviceBeacon returns true when push fields change', async () => {
    const snapshot = await saveDeviceBeaconSyncSnapshot(basePayload)
    expect(
      shouldSyncDeviceBeacon(snapshot, { ...basePayload, push_enabled: false }, false),
    ).toBe(true)
    expect(
      shouldSyncDeviceBeacon(snapshot, { ...basePayload, fcm_token: 'token-b' }, false),
    ).toBe(true)
  })

  it('shouldSyncDeviceBeacon returns false inside sync interval', async () => {
    await saveDeviceBeaconSyncSnapshot(basePayload)
    const snapshot = await getDeviceBeaconSyncSnapshot('profile-1', 'device-1')
    vi.advanceTimersByTime(DEVICE_BEACON_SYNC_INTERVAL_MS - 1)
    expect(shouldSyncDeviceBeacon(snapshot, basePayload, false)).toBe(false)
  })

  it('shouldSyncDeviceBeacon returns true after sync interval elapsed', async () => {
    await saveDeviceBeaconSyncSnapshot(basePayload)
    const snapshot = await getDeviceBeaconSyncSnapshot('profile-1', 'device-1')
    vi.advanceTimersByTime(DEVICE_BEACON_SYNC_INTERVAL_MS)
    expect(shouldSyncDeviceBeacon(snapshot, basePayload, false)).toBe(true)
  })

  it('handles invalid stored JSON gracefully', async () => {
    getPreferencesTestStore()['orbit_device_beacon_last_sync_v1'] = 'not-json'
    expect(await getDeviceBeaconSyncSnapshot('profile-1', 'device-1')).toBeNull()
  })

  it('returns empty list when stored JSON is not an array', async () => {
    getPreferencesTestStore()['orbit_device_beacon_last_sync_v1'] = JSON.stringify({
      stale: true,
    })
    expect(await getDeviceBeaconSyncSnapshot('profile-1', 'device-1')).toBeNull()
  })
})
