import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteDeviceBeacon, upsertDeviceBeacon } from '../deviceBeacon.api'

const eqMock = vi.fn()
const deleteMock = vi.fn(() => ({ eq: eqMock }))
const singleMock = vi.fn()
const selectMock = vi.fn(() => ({ single: singleMock }))
const upsertMock = vi.fn(() => ({ select: selectMock }))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: upsertMock,
      delete: deleteMock,
    })),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const basePayload = {
  profile_id: 'p1',
  device_id: 'd1',
  fcm_token: 't',
  push_enabled: true,
  platform: 'web',
  operating_system: 'linux',
  os_version: '1',
  manufacturer: 'm',
  model: 'x',
  web_view_version: 'w',
  device_name: 'n',
  is_virtual: false,
  android_sdk_version: 1,
  ios_version: 2,
} as const

describe('deviceBeacon.api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eqMock.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: null }) })
    singleMock.mockResolvedValue({
      data: {
        ...basePayload,
        location_permission_granted: false,
        location: null,
        location_accuracy_meters: null,
        location_recorded_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    })
  })

  it('deleteDeviceBeacon deletes by profile_id and device_id', async () => {
    const secondEq = vi.fn().mockResolvedValue({ error: null })
    eqMock.mockReset()
    eqMock.mockReturnValue({ eq: secondEq })

    const result = await deleteDeviceBeacon('profile-1', 'device-abc')

    expect(result.error).toBeNull()
    expect(deleteMock).toHaveBeenCalled()
    expect(eqMock).toHaveBeenCalledWith('profile_id', 'profile-1')
    expect(secondEq).toHaveBeenCalledWith('device_id', 'device-abc')
  })

  it('upsertDeviceBeacon succeeds and returns beacon', async () => {
    const result = await upsertDeviceBeacon({ ...basePayload })

    expect(result.error).toBeNull()
    expect(result.beacon?.profile_id).toBe('p1')
    expect(upsertMock).toHaveBeenCalled()
    expect(selectMock).toHaveBeenCalled()
  })

  it('upsertDeviceBeacon writes location fields when permission granted', async () => {
    await upsertDeviceBeacon({
      ...basePayload,
      location_permission_granted: true,
      latitude: -23.5505,
      longitude: -46.6333,
      location_accuracy_meters: 12.5,
      location_recorded_at: '2026-06-17T12:00:00.000Z',
    })

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        location_permission_granted: true,
        location: 'SRID=4326;POINT(-46.6333 -23.5505)',
        location_accuracy_meters: 12.5,
        location_recorded_at: '2026-06-17T12:00:00.000Z',
      }),
      { onConflict: 'profile_id,device_id' },
    )
  })

  it('upsertDeviceBeacon clears location when permission denied', async () => {
    await upsertDeviceBeacon({
      ...basePayload,
      location_permission_granted: false,
      latitude: -23.5505,
      longitude: -46.6333,
    })

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        location_permission_granted: false,
        location: null,
        location_accuracy_meters: null,
        location_recorded_at: null,
      }),
      { onConflict: 'profile_id,device_id' },
    )
  })

  it('deleteDeviceBeacon returns error message on failure', async () => {
    eqMock.mockReset()
    eqMock.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ error: { message: 'delete failed' } }),
    })

    const result = await deleteDeviceBeacon('profile-1', 'device-abc')

    expect(result.error).toBe('delete failed')
  })

  it('upsertDeviceBeacon returns error message on failure', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { message: 'db fail' } })

    const result = await upsertDeviceBeacon({
      ...basePayload,
      fcm_token: null,
      push_enabled: false,
      operating_system: null,
      os_version: null,
      manufacturer: null,
      model: null,
      web_view_version: null,
      device_name: null,
      android_sdk_version: null,
      ios_version: null,
    })

    expect(result.error).toBe('db fail')
    expect(result.beacon).toBeNull()
  })
})
