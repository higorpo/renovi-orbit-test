import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  getSession: vi.fn(),
  getSupabaseAnonKey: vi.fn(() => 'anon-key'),
}))

vi.mock('@capacitor/core', () => ({
  CapacitorHttp: { post: mocks.post },
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
  getSupabaseAnonKey: mocks.getSupabaseAnonKey,
}))

import {
  getDeviceBeaconAccessToken,
  upsertDeviceBeaconViaCapacitorHttp,
} from '../deviceBeaconHttp.api'

const basePayload = {
  profile_id: 'profile-1',
  device_id: 'device-1',
  fcm_token: 'token-1',
  push_enabled: true,
  platform: 'android',
  operating_system: 'android',
  os_version: '15',
  manufacturer: 'Google',
  model: 'Pixel',
  web_view_version: '130',
  device_name: 'Provider phone',
  is_virtual: false,
  android_sdk_version: 35,
  ios_version: null,
} as const

describe('deviceBeaconHttp.api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co/')
    mocks.post.mockResolvedValue({ status: 204, data: null })
  })

  it('returns the current session access token', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'access-token' } },
    })

    await expect(getDeviceBeaconAccessToken()).resolves.toBe('access-token')
  })

  it('returns null when there is no active session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })

    await expect(getDeviceBeaconAccessToken()).resolves.toBeNull()
  })

  it('posts an authenticated upsert with location fields', async () => {
    const result = await upsertDeviceBeaconViaCapacitorHttp(
      {
        ...basePayload,
        location_permission_granted: true,
        latitude: -23.5505,
        longitude: -46.6333,
        location_accuracy_meters: 8.5,
        location_recorded_at: '2026-07-10T20:00:00.000Z',
      },
      'access-token',
    )

    expect(result).toEqual({ error: null })
    expect(mocks.post).toHaveBeenCalledWith({
      url: 'https://project.supabase.co/rest/v1/user_device_beacons?on_conflict=profile_id,device_id',
      headers: {
        apikey: 'anon-key',
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      data: expect.objectContaining({
        profile_id: 'profile-1',
        device_id: 'device-1',
        location_permission_granted: true,
        location: 'SRID=4326;POINT(-46.6333 -23.5505)',
        location_accuracy_meters: 8.5,
        location_recorded_at: '2026-07-10T20:00:00.000Z',
        updated_at: expect.any(String),
      }),
    })
  })

  it('clears location fields unless permission and both coordinates are present', async () => {
    await upsertDeviceBeaconViaCapacitorHttp(
      {
        ...basePayload,
        location_permission_granted: true,
        latitude: -23.5505,
        longitude: null,
        location_accuracy_meters: 8.5,
        location_recorded_at: '2026-07-10T20:00:00.000Z',
      },
      'access-token',
    )

    expect(mocks.post).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          location: null,
          location_accuracy_meters: null,
          location_recorded_at: null,
        }),
      }),
    )
  })

  it('returns the server message for a failed response', async () => {
    mocks.post.mockResolvedValue({
      status: 401,
      data: { message: 'JWT expired' },
    })

    await expect(
      upsertDeviceBeaconViaCapacitorHttp(basePayload, 'expired-token'),
    ).resolves.toEqual({ error: 'JWT expired' })
  })

  it('falls back to the HTTP status when the response has no message', async () => {
    mocks.post.mockResolvedValue({ status: 503, data: 'Unavailable' })

    await expect(
      upsertDeviceBeaconViaCapacitorHttp(basePayload, 'access-token'),
    ).resolves.toEqual({ error: 'HTTP 503' })
  })

  it('converts transport failures into an error result', async () => {
    mocks.post.mockRejectedValue(new Error('Network unavailable'))

    await expect(
      upsertDeviceBeaconViaCapacitorHttp(basePayload, 'access-token'),
    ).resolves.toEqual({ error: 'Network unavailable' })
  })

  it('does not issue a request when the Supabase URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')

    await expect(
      upsertDeviceBeaconViaCapacitorHttp(basePayload, 'access-token'),
    ).resolves.toEqual({ error: 'VITE_SUPABASE_URL is not set' })
    expect(mocks.post).not.toHaveBeenCalled()
  })
})
