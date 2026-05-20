import { Device } from '@capacitor/device'

import { logger } from '@/lib/logger'

import { deleteDeviceBeacon } from '../api/deviceBeacon.api'
import { removeDeviceBeaconSyncSnapshot } from './syncSchedule'

/** Removes this installation's beacon row and local sync cache while still authenticated. */
export async function unregisterDeviceBeaconOnLogout(profileId: string): Promise<void> {
  try {
    const { identifier } = await Device.getId()
    const { error } = await deleteDeviceBeacon(profileId, identifier)

    if (error) {
      logger.warn('device_beacon_logout_delete_failed', {
        profileId,
        deviceId: identifier,
        reason: error,
      })
      return
    }

    removeDeviceBeaconSyncSnapshot(profileId, identifier)
    logger.info('device_beacon_removed_on_logout', { profileId, deviceId: identifier })
  } catch (error) {
    logger.warn('device_beacon_logout_unregister_failed', {
      profileId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
