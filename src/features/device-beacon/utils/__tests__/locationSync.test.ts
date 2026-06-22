import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCATION_SYNC_DEBOUNCE_MS } from '../../types/deviceBeacon.types'
import {
  __getLocationSyncDebounceStateForTests,
  resetLocationBeaconSyncState,
  scheduleLocationBeaconSync,
} from '../locationSync'
import { saveDeviceBeaconSyncSnapshot } from '../syncSchedule'

const upsertMock = vi.fn()
const collectMock = vi.fn()

vi.mock('../../api/deviceBeacon.api', () => ({
  upsertDeviceBeacon: (...args: unknown[]) => upsertMock(...args),
}))

vi.mock('../collectDeviceBeaconPayload', () => ({
  collectDeviceBeaconPayload: (...args: unknown[]) => collectMock(...args),
}))

vi.mock('../syncSchedule', () => ({
  saveDeviceBeaconSyncSnapshot: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../api/deviceBeaconHttp.api', () => ({
  getDeviceBeaconAccessToken: vi.fn(async () => null),
  upsertDeviceBeaconViaCapacitorHttp: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
  CapacitorHttp: { post: vi.fn() },
}))

describe('locationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(0)
    resetLocationBeaconSyncState()
    collectMock.mockImplementation(async (profileId: string, context?: {
      role?: string
      locationSample?: {
        latitude: number
        longitude: number
        accuracyMeters: number | null
        recordedAt: string
      }
    }) => ({
      profile_id: profileId,
      device_id: 'd1',
      fcm_token: null,
      push_enabled: false,
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
      ...(context?.role === 'provider' && context.locationSample
        ? {
            location_permission_granted: true,
            latitude: context.locationSample.latitude,
            longitude: context.locationSample.longitude,
            location_accuracy_meters: context.locationSample.accuracyMeters,
            location_recorded_at: context.locationSample.recordedAt,
          }
        : { location_permission_granted: false }),
    }))
    upsertMock.mockResolvedValue({ beacon: null, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces beacon upserts to LOCATION_SYNC_DEBOUNCE_MS', async () => {
    scheduleLocationBeaconSync('p1', {
      latitude: -23.5,
      longitude: -46.6,
      accuracyMeters: 10,
      recordedAt: '2026-06-17T12:00:00.000Z',
    })

    await vi.advanceTimersByTimeAsync(LOCATION_SYNC_DEBOUNCE_MS - 1)
    expect(upsertMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await Promise.resolve()

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: 'p1',
        location_permission_granted: true,
        latitude: -23.5,
        longitude: -46.6,
      }),
    )
    expect(__getLocationSyncDebounceStateForTests().lastSyncedAt).toBeGreaterThan(0)
    expect(saveDeviceBeaconSyncSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: 'p1',
        location_permission_granted: true,
      }),
    )
  })
})
