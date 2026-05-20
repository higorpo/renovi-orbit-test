import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saveDeviceBeaconSyncSnapshot and getDeviceBeaconSyncSnapshot round-trip', () => {
    const snapshot = saveDeviceBeaconSyncSnapshot(basePayload)
    expect(snapshot.profileId).toBe('profile-1')
    expect(getDeviceBeaconSyncSnapshot('profile-1', 'device-1')).toEqual(snapshot)
  })

  it('removeDeviceBeaconSyncSnapshot clears entry', () => {
    saveDeviceBeaconSyncSnapshot(basePayload)
    removeDeviceBeaconSyncSnapshot('profile-1', 'device-1')
    expect(getDeviceBeaconSyncSnapshot('profile-1', 'device-1')).toBeNull()
  })

  it('shouldSyncDeviceBeacon returns true when forced', () => {
    const snapshot = saveDeviceBeaconSyncSnapshot(basePayload)
    expect(shouldSyncDeviceBeacon(snapshot, basePayload, true)).toBe(true)
  })

  it('shouldSyncDeviceBeacon returns true without snapshot', () => {
    expect(shouldSyncDeviceBeacon(null, basePayload, false)).toBe(true)
  })

  it('shouldSyncDeviceBeacon returns true when push fields change', () => {
    const snapshot = saveDeviceBeaconSyncSnapshot(basePayload)
    expect(
      shouldSyncDeviceBeacon(snapshot, { ...basePayload, push_enabled: false }, false),
    ).toBe(true)
    expect(
      shouldSyncDeviceBeacon(snapshot, { ...basePayload, fcm_token: 'token-b' }, false),
    ).toBe(true)
  })

  it('shouldSyncDeviceBeacon returns false inside sync interval', () => {
    saveDeviceBeaconSyncSnapshot(basePayload)
    const snapshot = getDeviceBeaconSyncSnapshot('profile-1', 'device-1')
    vi.advanceTimersByTime(DEVICE_BEACON_SYNC_INTERVAL_MS - 1)
    expect(shouldSyncDeviceBeacon(snapshot, basePayload, false)).toBe(false)
  })

  it('shouldSyncDeviceBeacon returns true after sync interval elapsed', () => {
    saveDeviceBeaconSyncSnapshot(basePayload)
    const snapshot = getDeviceBeaconSyncSnapshot('profile-1', 'device-1')
    vi.advanceTimersByTime(DEVICE_BEACON_SYNC_INTERVAL_MS)
    expect(shouldSyncDeviceBeacon(snapshot, basePayload, false)).toBe(true)
  })

  it('handles invalid localStorage JSON gracefully', () => {
    localStorage.setItem('orbit_device_beacon_last_sync_v1', 'not-json')
    expect(getDeviceBeaconSyncSnapshot('profile-1', 'device-1')).toBeNull()
  })

  it('returns empty list when stored JSON is not an array', () => {
    localStorage.setItem('orbit_device_beacon_last_sync_v1', JSON.stringify({ stale: true }))
    expect(getDeviceBeaconSyncSnapshot('profile-1', 'device-1')).toBeNull()
  })
})
