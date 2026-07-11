import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCATION_SYNC_DEBOUNCE_MS } from '../../types/deviceBeacon.types'
import {
  __getLocationSyncDebounceStateForTests,
  flushLocationBeaconSyncNow,
  getLatestProviderLocationSample,
  resetLocationBeaconSyncState,
  scheduleLocationBeaconSync,
  subscribeProviderLocationSamples,
  syncProviderBeaconNow,
} from '../locationSync'
import { saveDeviceBeaconSyncSnapshot } from '../syncSchedule'

const upsertMock = vi.fn()
const collectMock = vi.fn()
const getAccessTokenMock = vi.fn(async () => null as string | null)
const upsertHttpMock = vi.fn()
const loggerWarnMock = vi.fn()
const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
}))

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
  getDeviceBeaconAccessToken: (...args: unknown[]) => getAccessTokenMock(...args),
  upsertDeviceBeaconViaCapacitorHttp: (...args: unknown[]) => upsertHttpMock(...args),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: (...args: unknown[]) => loggerWarnMock(...args) },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => capacitorMocks.isNativePlatform(),
    getPlatform: () => capacitorMocks.getPlatform(),
  },
  CapacitorHttp: { post: vi.fn() },
}))

const sample = {
  latitude: -23.5,
  longitude: -46.6,
  accuracyMeters: 10,
  recordedAt: '2026-06-17T12:00:00.000Z',
}

describe('locationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(0)
    resetLocationBeaconSyncState()
    capacitorMocks.isNativePlatform.mockReturnValue(false)
    capacitorMocks.getPlatform.mockReturnValue('web')
    getAccessTokenMock.mockResolvedValue(null)
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
    scheduleLocationBeaconSync('p1', sample)

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

  it('remembers the latest sample and notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeProviderLocationSamples(listener)

    scheduleLocationBeaconSync('p1', sample)

    expect(getLatestProviderLocationSample('p1')).toEqual(sample)
    expect(listener).toHaveBeenCalledWith('p1', sample)

    unsubscribe()
    scheduleLocationBeaconSync('p1', { ...sample, latitude: -23.6 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('flushes a pending sync immediately', async () => {
    scheduleLocationBeaconSync('p1', sample)
    expect(upsertMock).not.toHaveBeenCalled()

    await flushLocationBeaconSyncNow()

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: 'p1', latitude: -23.5 }),
    )
  })

  it('resyncs later when an upsert fails', async () => {
    upsertMock.mockResolvedValueOnce({ beacon: null, error: 'network' })
    scheduleLocationBeaconSync('p1', sample)

    await vi.advanceTimersByTimeAsync(LOCATION_SYNC_DEBOUNCE_MS)
    await Promise.resolve()

    expect(loggerWarnMock).toHaveBeenCalledWith(
      'provider_location_sync_failed',
      expect.objectContaining({ profileId: 'p1', reason: 'network' }),
    )
    expect(__getLocationSyncDebounceStateForTests().pending).toEqual({
      profileId: 'p1',
      sample,
    })
  })

  it('syncProviderBeaconNow upserts using the latest sample', async () => {
    scheduleLocationBeaconSync('p1', sample)
    await syncProviderBeaconNow('p1')

    expect(collectMock).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ role: 'provider', locationSample: sample }),
    )
    expect(upsertMock).toHaveBeenCalled()
  })

  it('logs when syncProviderBeaconNow upsert fails', async () => {
    upsertMock.mockResolvedValue({ beacon: null, error: 'auth' })
    await syncProviderBeaconNow('p1')

    expect(loggerWarnMock).toHaveBeenCalledWith(
      'provider_beacon_permission_sync_failed',
      expect.objectContaining({ profileId: 'p1', reason: 'auth' }),
    )
  })

  it('uses Capacitor HTTP on Android when an access token is available', async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true)
    capacitorMocks.getPlatform.mockReturnValue('android')
    getAccessTokenMock.mockResolvedValue('token-1')
    upsertHttpMock.mockResolvedValue({ error: null })

    scheduleLocationBeaconSync('p1', sample)
    await flushLocationBeaconSyncNow()

    expect(upsertHttpMock).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: 'p1' }),
      'token-1',
    )
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('falls back to supabase upsert when Capacitor HTTP fails', async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true)
    capacitorMocks.getPlatform.mockReturnValue('android')
    getAccessTokenMock.mockResolvedValue('token-1')
    upsertHttpMock.mockResolvedValue({ error: 'http-failed' })

    scheduleLocationBeaconSync('p1', sample)
    await flushLocationBeaconSyncNow()

    expect(loggerWarnMock).toHaveBeenCalledWith(
      'provider_location_sync_http_fallback',
      { reason: 'http-failed' },
    )
    expect(upsertMock).toHaveBeenCalled()
  })

  it('clears pending state on reset', () => {
    scheduleLocationBeaconSync('p1', sample)
    resetLocationBeaconSyncState()

    expect(getLatestProviderLocationSample('p1')).toBeNull()
    expect(__getLocationSyncDebounceStateForTests().pending).toBeNull()
    expect(__getLocationSyncDebounceStateForTests().timerId).toBeNull()
  })
})
