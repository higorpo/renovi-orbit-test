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
})
