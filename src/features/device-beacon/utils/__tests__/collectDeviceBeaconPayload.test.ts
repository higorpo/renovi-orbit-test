import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: vi.fn(() => 'web') },
}))

vi.mock('@capacitor/device', () => ({
  Device: {
    getId: vi.fn().mockResolvedValue({ identifier: 'device-99' }),
    getInfo: vi.fn().mockResolvedValue({
      platform: 'android',
      operatingSystem: 'android',
      osVersion: '14',
      manufacturer: 'Google',
      model: 'Pixel',
      webViewVersion: '120',
      name: 'Phone',
      isVirtual: false,
      androidSDKVersion: 34,
      iOSVersion: undefined,
    }),
  },
}))

vi.mock('@/lib/push', () => ({
  getPushRegistrationState: vi.fn().mockResolvedValue({
    platform: 'web',
    pushEnabled: true,
    fcmToken: 'fcm-1',
    permission: 'granted',
  }),
}))

vi.mock('../locationPermissionPrompt.storage', () => ({
  getStoredLocationPermissionGranted: vi.fn().mockResolvedValue(null),
}))

vi.mock('../requestOperationalLocationPermission', () => ({
  getOperationalLocationPermissionStatus: vi.fn().mockResolvedValue('granted'),
}))

vi.mock('../locationSync', () => ({
  getLatestProviderLocationSample: vi.fn(() => null),
}))

import { Device } from '@capacitor/device'
import { getPushRegistrationState } from '@/lib/push'
import { getStoredLocationPermissionGranted } from '../locationPermissionPrompt.storage'
import { getOperationalLocationPermissionStatus } from '../requestOperationalLocationPermission'
import { getLatestProviderLocationSample } from '../locationSync'

import {
  buildPayloadFromPushState,
  collectDeviceBeaconPayload,
} from '../collectDeviceBeaconPayload'

describe('collectDeviceBeaconPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getStoredLocationPermissionGranted).mockResolvedValue(null)
    vi.mocked(getOperationalLocationPermissionStatus).mockResolvedValue('granted')
    vi.mocked(getLatestProviderLocationSample).mockReturnValue(null)
  })

  it('collectDeviceBeaconPayload builds upsert payload', async () => {
    const payload = await collectDeviceBeaconPayload('user-1')

    expect(payload).toMatchObject({
      profile_id: 'user-1',
      device_id: 'device-99',
      fcm_token: 'fcm-1',
      push_enabled: true,
      platform: 'web',
      manufacturer: 'Google',
      model: 'Pixel',
    })
    expect(Device.getId).toHaveBeenCalled()
    expect(getPushRegistrationState).toHaveBeenCalledWith({ requestPermission: false })
  })

  it('includes location fields for provider with permission and sample', async () => {
    vi.mocked(getLatestProviderLocationSample).mockReturnValue({
      latitude: -27.5,
      longitude: -48.5,
      accuracyMeters: 12,
      recordedAt: '2026-06-18T12:00:00.000Z',
    })

    const payload = await collectDeviceBeaconPayload('user-1', { role: 'provider' })

    expect(payload.location_permission_granted).toBe(true)
    expect(payload.latitude).toBe(-27.5)
    expect(payload.longitude).toBe(-48.5)
    expect(payload.location_accuracy_meters).toBe(12)
    expect(payload.location_recorded_at).toBe('2026-06-18T12:00:00.000Z')
  })

  it('does not fabricate coordinates for client role', async () => {
    vi.mocked(getLatestProviderLocationSample).mockReturnValue({
      latitude: -27.5,
      longitude: -48.5,
      accuracyMeters: 12,
      recordedAt: '2026-06-18T12:00:00.000Z',
    })

    const payload = await collectDeviceBeaconPayload('user-1', { role: 'client' })

    expect(payload.location_permission_granted).toBe(false)
    expect(payload.latitude).toBeUndefined()
    expect(payload.longitude).toBeUndefined()
  })

  it('omits coordinates when permission is denied', async () => {
    vi.mocked(getStoredLocationPermissionGranted).mockResolvedValue(false)
    vi.mocked(getOperationalLocationPermissionStatus).mockResolvedValue('denied')

    const payload = await collectDeviceBeaconPayload('user-1', { role: 'provider' })

    expect(payload.location_permission_granted).toBe(false)
    expect(payload.latitude).toBeUndefined()
    expect(payload.longitude).toBeUndefined()
  })

  it('does not mark permission granted before OS result is known', async () => {
    vi.mocked(getOperationalLocationPermissionStatus).mockResolvedValue('prompt')
    vi.mocked(getStoredLocationPermissionGranted).mockResolvedValue(null)

    const payload = await collectDeviceBeaconPayload('user-1', { role: 'provider' })

    expect(payload.location_permission_granted).toBe(false)
    expect(payload.latitude).toBeUndefined()
  })

  it('maps optional device info fields', async () => {
    vi.mocked(Device.getInfo).mockResolvedValueOnce({
      platform: 'ios',
      operatingSystem: 'ios',
      osVersion: '17',
      manufacturer: 'Apple',
      model: 'iPhone',
      webViewVersion: '605',
      isVirtual: true,
      iOSVersion: 170000,
    })

    const payload = await collectDeviceBeaconPayload('user-3')

    expect(payload.device_name).toBeNull()
    expect(payload.is_virtual).toBe(true)
    expect(payload.ios_version).toBe(170000)
  })

  it('defaults nullable device info fields when missing', async () => {
    vi.mocked(Device.getInfo).mockResolvedValueOnce({
      platform: 'web',
      operatingSystem: undefined,
      osVersion: undefined,
      manufacturer: undefined,
      model: undefined,
      webViewVersion: undefined,
      name: undefined,
      isVirtual: undefined,
      androidSDKVersion: undefined,
      iOSVersion: undefined,
    } as unknown as Awaited<ReturnType<typeof Device.getInfo>>)

    const payload = await collectDeviceBeaconPayload('user-sparse')

    expect(payload.operating_system).toBeNull()
    expect(payload.os_version).toBeNull()
    expect(payload.manufacturer).toBeNull()
    expect(payload.model).toBeNull()
    expect(payload.web_view_version).toBeNull()
    expect(payload.device_name).toBeNull()
    expect(payload.is_virtual).toBe(false)
    expect(payload.android_sdk_version).toBeNull()
    expect(payload.ios_version).toBeNull()
  })

  it('buildPayloadFromPushState nullifies token when push disabled', async () => {
    const info = await Device.getInfo()
    const payload = await buildPayloadFromPushState('user-2', 'dev-2', info, {
      platform: 'web',
      pushEnabled: false,
      fcmToken: 'ignored',
      permission: 'denied',
    })

    expect(payload.fcm_token).toBeNull()
    expect(payload.push_enabled).toBe(false)
  })
})
