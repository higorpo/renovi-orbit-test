import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEVICE_BEACON_SYNC_STORAGE_KEY } from '../../types/deviceBeacon.types'
import { unregisterDeviceBeaconOnLogout } from '../unregisterDeviceBeaconOnLogout'

vi.mock('@capacitor/device', () => ({
  Device: {
    getId: vi.fn().mockResolvedValue({ identifier: 'device-xyz' }),
  },
}))

vi.mock('../../api/deviceBeacon.api', () => ({
  deleteDeviceBeacon: vi.fn().mockResolvedValue({ error: null }),
}))

const { deleteDeviceBeacon } = await import('../../api/deviceBeacon.api')

describe('unregisterDeviceBeaconOnLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem(
      DEVICE_BEACON_SYNC_STORAGE_KEY,
      JSON.stringify([
        {
          profileId: 'user-1',
          deviceId: 'device-xyz',
          lastSyncedAt: new Date().toISOString(),
          pushEnabled: true,
          fcmToken: 'token',
        },
      ]),
    )
  })

  it('deletes beacon and clears local sync snapshot', async () => {
    await unregisterDeviceBeaconOnLogout('user-1')

    expect(deleteDeviceBeacon).toHaveBeenCalledWith('user-1', 'device-xyz')

    const remaining = JSON.parse(
      localStorage.getItem(DEVICE_BEACON_SYNC_STORAGE_KEY) ?? '[]',
    ) as unknown[]
    expect(remaining).toHaveLength(0)
  })

  it('does not clear local snapshot when delete fails', async () => {
    vi.mocked(deleteDeviceBeacon).mockResolvedValueOnce({ error: 'db error' })

    await unregisterDeviceBeaconOnLogout('user-1')

    const remaining = JSON.parse(
      localStorage.getItem(DEVICE_BEACON_SYNC_STORAGE_KEY) ?? '[]',
    ) as unknown[]
    expect(remaining).toHaveLength(1)
  })

  it('handles Device.getId failure gracefully', async () => {
    const { Device } = await import('@capacitor/device')
    vi.mocked(Device.getId).mockRejectedValueOnce(new Error('no device'))

    await expect(unregisterDeviceBeaconOnLogout('user-1')).resolves.toBeUndefined()
  })

  it('handles non-Error throw from Device.getId', async () => {
    const { Device } = await import('@capacitor/device')
    vi.mocked(Device.getId).mockRejectedValueOnce('device unavailable')

    await expect(unregisterDeviceBeaconOnLogout('user-1')).resolves.toBeUndefined()
  })
})
