// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const capMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
}))

const bgMocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  requestPermissions: vi.fn(),
  checkPermissions: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: capMocks.isNativePlatform,
  },
}))

vi.mock('@capgo/background-geolocation', () => ({
  BackgroundGeolocation: bgMocks,
}))

import {
  captureNativeOperationalLocationFix,
  captureOperationalLocationFix,
  getOperationalLocationPermissionStatus,
  requestOperationalLocationPermission,
} from '../requestOperationalLocationPermission'

describe('requestOperationalLocationPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capMocks.isNativePlatform.mockReturnValue(false)
    bgMocks.stop.mockResolvedValue(undefined)
    bgMocks.requestPermissions.mockResolvedValue({ location: 'granted' })
    bgMocks.checkPermissions.mockResolvedValue({ location: 'prompt' })
  })

  it('uses browser geolocation on web when permission is granted', async () => {
    const getCurrentPosition = vi.fn((success) => {
      success({
        coords: { latitude: -27.5, longitude: -48.5, accuracy: 10 },
      })
    })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })

    const result = await requestOperationalLocationPermission()

    expect(result).toEqual({
      granted: true,
      status: 'granted',
      latitude: -27.5,
      longitude: -48.5,
      accuracyMeters: 10,
    })
    expect(bgMocks.start).not.toHaveBeenCalled()
  })

  it('requests native permission and captures fix via BackgroundGeolocation', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    bgMocks.requestPermissions.mockResolvedValue({ location: 'granted' })
    bgMocks.start.mockImplementation((_options, callback) => {
      callback(
        { latitude: -27.5, longitude: -48.5, accuracy: 12 },
        undefined,
      )
      return Promise.resolve()
    })

    const result = await requestOperationalLocationPermission()

    expect(bgMocks.requestPermissions).toHaveBeenCalledWith({ permissions: ['location'] })
    expect(bgMocks.start).toHaveBeenCalledWith(
      expect.objectContaining({ requestPermissions: false, stale: true, distanceFilter: 0 }),
      expect.any(Function),
    )
    expect(bgMocks.stop).toHaveBeenCalled()
    expect(result).toEqual({
      granted: true,
      status: 'granted',
      latitude: -27.5,
      longitude: -48.5,
      accuracyMeters: 12,
    })
  })

  it('reads native permission status via plugin checkPermissions', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    bgMocks.checkPermissions.mockResolvedValue({ location: 'granted' })

    await expect(getOperationalLocationPermissionStatus()).resolves.toBe('granted')
  })

  it('captureOperationalLocationFix uses native plugin on native platforms', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    bgMocks.start.mockImplementation((_options, callback) => {
      callback(
        { latitude: -27.1, longitude: -48.1, accuracy: 8 },
        undefined,
      )
      return Promise.resolve()
    })

    await expect(captureOperationalLocationFix()).resolves.toEqual({
      granted: true,
      status: 'granted',
      latitude: -27.1,
      longitude: -48.1,
      accuracyMeters: 8,
    })
  })

  it('captureNativeOperationalLocationFix does not use navigator.geolocation', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    const getCurrentPosition = vi.fn()
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })
    bgMocks.start.mockImplementation((_options, callback) => {
      callback(
        { latitude: -27.2, longitude: -48.2, accuracy: 15 },
        undefined,
      )
      return Promise.resolve()
    })

    await expect(captureNativeOperationalLocationFix()).resolves.toMatchObject({
      latitude: -27.2,
      longitude: -48.2,
    })
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('returns denied when browser geolocation permission is refused', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: unknown, error: (err: { code: number }) => void) => {
          error({ code: 1 })
        },
      },
    })

    await expect(requestOperationalLocationPermission()).resolves.toEqual({
      granted: false,
      status: 'denied',
    })
  })

  it('returns prompt when browser geolocation fails for a non-permission reason', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: unknown, error: (err: { code: number }) => void) => {
          error({ code: 3 })
        },
      },
    })

    await expect(requestOperationalLocationPermission()).resolves.toEqual({
      granted: false,
      status: 'prompt',
    })
  })

  it('returns unsupported when browser geolocation is missing', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })

    await expect(requestOperationalLocationPermission()).resolves.toEqual({
      granted: false,
      status: 'unsupported',
    })
  })

  it('returns unsupported when native requestPermissions is unavailable', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    const original = bgMocks.requestPermissions
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- simulate missing plugin method
    delete (bgMocks as { requestPermissions?: unknown }).requestPermissions

    await expect(requestOperationalLocationPermission()).resolves.toEqual({
      granted: false,
      status: 'unsupported',
    })

    bgMocks.requestPermissions = original
  })

  it('returns denied when native requestPermissions throws', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    bgMocks.requestPermissions.mockRejectedValue(new Error('plugin down'))

    await expect(requestOperationalLocationPermission()).resolves.toEqual({
      granted: false,
      status: 'denied',
    })
  })

  it('returns denied without capturing a fix when native permission is denied', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    bgMocks.requestPermissions.mockResolvedValue({ location: 'denied' })

    await expect(requestOperationalLocationPermission()).resolves.toEqual({
      granted: false,
      status: 'denied',
    })
    expect(bgMocks.start).not.toHaveBeenCalled()
  })

  it('returns granted without coordinates when native fix capture fails', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    bgMocks.requestPermissions.mockResolvedValue({ location: 'granted' })
    bgMocks.start.mockRejectedValue(new Error('start failed'))

    await expect(requestOperationalLocationPermission()).resolves.toEqual({
      granted: true,
      status: 'granted',
    })
  })

  it('reads browser permission status via Permissions API', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    })
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: 'denied' }),
      },
    })

    await expect(getOperationalLocationPermissionStatus()).resolves.toBe('denied')
  })

  it('falls back to prompt when Permissions API query fails', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    })
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockRejectedValue(new Error('unavailable')),
      },
    })

    await expect(getOperationalLocationPermissionStatus()).resolves.toBe('prompt')
  })

  it('returns unsupported when geolocation is unavailable on web', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })

    await expect(getOperationalLocationPermissionStatus()).resolves.toBe('unsupported')
  })

  it('falls through when native checkPermissions is missing', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    const original = bgMocks.checkPermissions
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- simulate missing plugin method
    delete (bgMocks as { checkPermissions?: unknown }).checkPermissions
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    })
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: 'granted' }),
      },
    })

    await expect(getOperationalLocationPermissionStatus()).resolves.toBe('granted')
    bgMocks.checkPermissions = original
  })

  it('maps unknown native permission states to prompt after request', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    bgMocks.requestPermissions.mockResolvedValue({ location: 'limited' })

    await expect(requestOperationalLocationPermission()).resolves.toEqual({
      granted: false,
      status: 'prompt',
    })
  })

  it('captureOperationalLocationFix returns null for non-permission browser errors', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: unknown, error: (err: { code: number }) => void) => {
          error({ code: 2 })
        },
      },
    })

    await expect(captureOperationalLocationFix()).resolves.toBeNull()
  })

  it('falls through to browser status when native checkPermissions throws', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    bgMocks.checkPermissions.mockRejectedValue(new Error('check failed'))
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    })
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: 'prompt' }),
      },
    })

    await expect(getOperationalLocationPermissionStatus()).resolves.toBe('prompt')
  })

  it('captureOperationalLocationFix uses browser geolocation on web', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: (pos: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) => {
          success({ coords: { latitude: -22.9, longitude: -43.2, accuracy: 5 } })
        },
      },
    })

    await expect(captureOperationalLocationFix()).resolves.toEqual({
      granted: true,
      status: 'granted',
      latitude: -22.9,
      longitude: -43.2,
      accuracyMeters: 5,
    })
  })

  it('captureOperationalLocationFix returns denied when browser permission is refused', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: unknown, error: (err: { code: number }) => void) => {
          error({ code: 1 })
        },
      },
    })

    await expect(captureOperationalLocationFix()).resolves.toEqual({
      granted: false,
      status: 'denied',
    })
  })

  it('captureNativeOperationalLocationFix returns null when start rejects', async () => {
    bgMocks.start.mockRejectedValue(new Error('unavailable'))

    await expect(captureNativeOperationalLocationFix()).resolves.toBeNull()
  })

  it('captureNativeOperationalLocationFix ignores error callbacks without settling', async () => {
    vi.useFakeTimers()
    bgMocks.start.mockImplementation((_options, callback) => {
      callback(undefined, { code: 'POSITION_UNAVAILABLE' })
      return Promise.resolve()
    })

    const pending = captureNativeOperationalLocationFix()
    await vi.advanceTimersByTimeAsync(25_000)
    await expect(pending).resolves.toBeNull()
    vi.useRealTimers()
  })
})

describe('requestOperationalLocationPermission additional branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capMocks.isNativePlatform.mockReturnValue(false)
    bgMocks.stop.mockResolvedValue(undefined)
    bgMocks.requestPermissions.mockResolvedValue({ location: 'granted' })
    bgMocks.checkPermissions.mockResolvedValue({ location: 'prompt' })
  })

  it('falls through to web permissions when native status is restricted', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    bgMocks.checkPermissions.mockResolvedValue({ location: 'restricted' })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    })
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state: 'denied' }) },
    })

    await expect(getOperationalLocationPermissionStatus()).resolves.toBe('denied')
  })

  it('returns null when browser geolocation is unavailable during capture', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })

    await expect(captureOperationalLocationFix()).resolves.toBeNull()
  })

  it('ignores a second native callback after settling', async () => {
    bgMocks.start.mockImplementation((_options, callback) => {
      callback({ latitude: 1, longitude: 2, accuracy: 3 }, undefined)
      callback({ latitude: 4, longitude: 5, accuracy: 6 }, undefined)
      return Promise.resolve()
    })

    await expect(captureNativeOperationalLocationFix()).resolves.toMatchObject({
      latitude: 1,
      longitude: 2,
    })
    expect(bgMocks.stop).toHaveBeenCalledTimes(1)
  })

  it('settles from a valid native location after an error callback', async () => {
    bgMocks.start.mockImplementation((_options, callback) => {
      callback(undefined, { code: 'POSITION_UNAVAILABLE' })
      callback({ latitude: 7, longitude: 8 }, undefined)
      return Promise.resolve()
    })

    await expect(captureNativeOperationalLocationFix()).resolves.toEqual({
      granted: true,
      status: 'granted',
      latitude: 7,
      longitude: 8,
      accuracyMeters: null,
    })
  })

  it('times out when a native location is missing longitude', async () => {
    vi.useFakeTimers()
    bgMocks.start.mockImplementation((_options, callback) => {
      callback({ latitude: 7 }, undefined)
      return Promise.resolve()
    })

    const pending = captureNativeOperationalLocationFix()
    await vi.advanceTimersByTimeAsync(25_000)
    await expect(pending).resolves.toBeNull()
    vi.useRealTimers()
  })

  it('returns prompt without starting native capture', async () => {
    capMocks.isNativePlatform.mockReturnValue(true)
    bgMocks.requestPermissions.mockResolvedValue({ location: 'prompt' })

    await expect(requestOperationalLocationPermission()).resolves.toEqual({
      granted: false,
      status: 'prompt',
    })
    expect(bgMocks.start).not.toHaveBeenCalled()
  })

  it('returns bare granted when the native fix has no coordinates', async () => {
    vi.useFakeTimers()
    capMocks.isNativePlatform.mockReturnValue(true)
    bgMocks.start.mockImplementation((_options, callback) => {
      callback({ latitude: 9 }, undefined)
      return Promise.resolve()
    })

    const pending = requestOperationalLocationPermission()
    await vi.advanceTimersByTimeAsync(25_000)
    await expect(pending).resolves.toEqual({ granted: true, status: 'granted' })
    vi.useRealTimers()
  })

  it('maps an unknown web permission state to prompt', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    })
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state: 'limited' }) },
    })

    await expect(getOperationalLocationPermissionStatus()).resolves.toBe('prompt')
  })
})
