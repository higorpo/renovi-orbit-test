import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteDeviceBeacon, upsertDeviceBeacon } from '../deviceBeacon.api'

const eqMock = vi.fn()
const deleteMock = vi.fn(() => ({ eq: eqMock }))
const upsertMock = vi.fn()

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

describe('deviceBeacon.api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eqMock.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: null }) })
    upsertMock.mockResolvedValue({ error: null })
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

  it('upsertDeviceBeacon succeeds without error', async () => {
    const result = await upsertDeviceBeacon({
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
    })
    expect(result.error).toBeNull()
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
    upsertMock.mockResolvedValueOnce({ error: { message: 'db fail' } })

    const result = await upsertDeviceBeacon({
      profile_id: 'p1',
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
    })

    expect(result.error).toBe('db fail')
  })
})
