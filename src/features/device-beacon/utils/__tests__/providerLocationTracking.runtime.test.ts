// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  backgroundStart: vi.fn(),
  backgroundStop: vi.fn(),
  getStoredPermission: vi.fn(),
  setStoredPermission: vi.fn(),
  scheduleSync: vi.fn(),
  flushSync: vi.fn(),
  resetSync: vi.fn(),
  captureNativeFix: vi.fn(),
  getPermissionStatus: vi.fn(),
  loggerWarn: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}))

vi.mock('@capgo/background-geolocation', () => ({
  BackgroundGeolocation: {
    start: mocks.backgroundStart,
    stop: mocks.backgroundStop,
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: mocks.loggerWarn },
}))

vi.mock('../locationPermissionPrompt.storage', () => ({
  getStoredLocationPermissionGranted: mocks.getStoredPermission,
  setStoredLocationPermissionGranted: mocks.setStoredPermission,
}))

vi.mock('../locationSync', () => ({
  scheduleLocationBeaconSync: mocks.scheduleSync,
  flushLocationBeaconSyncNow: mocks.flushSync,
  resetLocationBeaconSyncState: mocks.resetSync,
}))

vi.mock('../requestOperationalLocationPermission', () => ({
  captureNativeOperationalLocationFix: mocks.captureNativeFix,
  getOperationalLocationPermissionStatus: mocks.getPermissionStatus,
}))

import {
  __resetProviderLocationTrackingStateForTests,
  isProviderLocationTrackingActive,
  startProviderLocationTracking,
  stopProviderLocationTracking,
} from '../providerLocationTracking.runtime'

type WebSuccess = PositionCallback
type WebError = PositionErrorCallback
type NativeCallback = (
  location?: { latitude: number; longitude: number; accuracy?: number },
  error?: { code: string },
) => void

let webSuccess: WebSuccess
let webError: WebError
let nativeCallback: NativeCallback
const watchPosition = vi.fn((success: WebSuccess, error: WebError) => {
  webSuccess = success
  webError = error
  return 42
})
const clearWatch = vi.fn()

describe('providerLocationTracking.runtime', () => {
  beforeEach(() => {
    __resetProviderLocationTrackingStateForTests()
    vi.clearAllMocks()
    mocks.isNativePlatform.mockReturnValue(false)
    mocks.getStoredPermission.mockResolvedValue(true)
    mocks.getPermissionStatus.mockResolvedValue('granted')
    mocks.setStoredPermission.mockResolvedValue(undefined)
    mocks.flushSync.mockResolvedValue(undefined)
    mocks.captureNativeFix.mockResolvedValue(null)
    mocks.backgroundStop.mockResolvedValue(undefined)
    mocks.backgroundStart.mockImplementation(
      (_options: unknown, callback: NativeCallback) => {
        nativeCallback = callback
        return Promise.resolve()
      },
    )
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch },
    })
  })

  it.each([
    [false, 'granted'],
    [true, 'denied'],
    [true, 'unsupported'],
  ] as const)(
    'does not start when stored permission is %s and runtime status is %s',
    async (storedPermission, status) => {
      mocks.getStoredPermission.mockResolvedValue(storedPermission)
      mocks.getPermissionStatus.mockResolvedValue(status)

      await startProviderLocationTracking('provider-1')

      expect(watchPosition).not.toHaveBeenCalled()
      expect(mocks.backgroundStart).not.toHaveBeenCalled()
      expect(isProviderLocationTrackingActive()).toBe(false)
    },
  )

  it('tracks browser samples and clears the watch on stop', async () => {
    vi.setSystemTime('2026-07-10T20:00:00.000Z')

    await startProviderLocationTracking('provider-1')
    webSuccess({
      coords: {
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 12,
      },
    } as GeolocationPosition)

    expect(isProviderLocationTrackingActive()).toBe(true)
    expect(mocks.scheduleSync).toHaveBeenCalledWith('provider-1', {
      latitude: -23.5505,
      longitude: -46.6333,
      accuracyMeters: 12,
      recordedAt: '2026-07-10T20:00:00.000Z',
    })

    await stopProviderLocationTracking()

    expect(clearWatch).toHaveBeenCalledWith(42)
    expect(mocks.resetSync).toHaveBeenCalled()
    expect(isProviderLocationTrackingActive()).toBe(false)
  })

  it('persists browser permission revocation and stops tracking', async () => {
    await startProviderLocationTracking('provider-1')

    webError({ code: 1 } as GeolocationPositionError)

    expect(mocks.setStoredPermission).toHaveBeenCalledWith(false)
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'provider_location_tracking_revoked',
      { profileId: 'provider-1' },
    )
    expect(clearWatch).toHaveBeenCalledWith(42)
    expect(isProviderLocationTrackingActive()).toBe(false)
  })

  it('seeds native tracking, flushes it, and schedules subsequent samples', async () => {
    vi.setSystemTime('2026-07-10T20:00:00.000Z')
    mocks.isNativePlatform.mockReturnValue(true)
    mocks.captureNativeFix.mockResolvedValue({
      latitude: -27.5949,
      longitude: -48.5482,
      accuracyMeters: 7,
    })

    await startProviderLocationTracking('provider-1')

    expect(mocks.scheduleSync).toHaveBeenNthCalledWith(1, 'provider-1', {
      latitude: -27.5949,
      longitude: -48.5482,
      accuracyMeters: 7,
      recordedAt: '2026-07-10T20:00:00.000Z',
    })
    expect(mocks.flushSync).toHaveBeenCalled()
    expect(mocks.backgroundStart).toHaveBeenCalledWith(
      expect.objectContaining({
        requestPermissions: false,
        stale: false,
        distanceFilter: 350,
      }),
      expect.any(Function),
    )

    nativeCallback({ latitude: -27.6, longitude: -48.6, accuracy: 10 })

    expect(mocks.scheduleSync).toHaveBeenLastCalledWith(
      'provider-1',
      expect.objectContaining({
        latitude: -27.6,
        longitude: -48.6,
        accuracyMeters: 10,
      }),
    )
    expect(isProviderLocationTrackingActive()).toBe(true)
  })

  it('does not start a second native tracker while already active', async () => {
    mocks.isNativePlatform.mockReturnValue(true)

    await startProviderLocationTracking('provider-1')
    await startProviderLocationTracking('provider-1')

    expect(mocks.backgroundStart).toHaveBeenCalledTimes(1)
  })

  it('stops native tracking after authorization is revoked', async () => {
    mocks.isNativePlatform.mockReturnValue(true)
    await startProviderLocationTracking('provider-1')

    nativeCallback(undefined, { code: 'NOT_AUTHORIZED' })
    await vi.waitFor(() => expect(mocks.backgroundStop).toHaveBeenCalled())

    expect(mocks.setStoredPermission).toHaveBeenCalledWith(false)
    expect(isProviderLocationTrackingActive()).toBe(false)
  })

  it('resets native state even when the plugin stop call fails', async () => {
    mocks.isNativePlatform.mockReturnValue(true)
    mocks.backgroundStop.mockRejectedValue(new Error('Plugin unavailable'))
    await startProviderLocationTracking('provider-1')

    await stopProviderLocationTracking()

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'provider_location_tracking_stop_failed',
      { message: 'Plugin unavailable' },
    )
    expect(mocks.resetSync).toHaveBeenCalled()
    expect(isProviderLocationTrackingActive()).toBe(false)
  })

  it('ignores native callbacks that have neither a location nor an auth error', async () => {
    mocks.isNativePlatform.mockReturnValue(true)
    await startProviderLocationTracking('provider-1')

    nativeCallback(undefined, { code: 'POSITION_UNAVAILABLE' })
    nativeCallback(undefined)

    expect(mocks.scheduleSync).not.toHaveBeenCalled()
    expect(mocks.setStoredPermission).not.toHaveBeenCalled()
    expect(isProviderLocationTrackingActive()).toBe(true)
  })

  it('does not start web tracking when geolocation is unavailable', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })

    await startProviderLocationTracking('provider-1')

    expect(watchPosition).not.toHaveBeenCalled()
    expect(isProviderLocationTrackingActive()).toBe(false)
  })

  it('does not start a second web watch while already active', async () => {
    await startProviderLocationTracking('provider-1')
    await startProviderLocationTracking('provider-1')

    expect(watchPosition).toHaveBeenCalledTimes(1)
  })

  it('skips seeding when the native fix has no coordinates', async () => {
    mocks.isNativePlatform.mockReturnValue(true)
    mocks.captureNativeFix.mockResolvedValue({
      granted: true,
      status: 'granted',
      latitude: undefined,
      longitude: undefined,
    })

    await startProviderLocationTracking('provider-1')

    expect(mocks.scheduleSync).not.toHaveBeenCalled()
    expect(mocks.flushSync).not.toHaveBeenCalled()
    expect(mocks.backgroundStart).toHaveBeenCalled()
  })
})
