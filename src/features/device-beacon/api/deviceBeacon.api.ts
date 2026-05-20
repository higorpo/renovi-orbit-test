import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

import type { DeviceBeaconUpsertPayload, UpsertDeviceBeaconResult } from '../types/deviceBeacon.types'

export async function upsertDeviceBeacon(
  payload: DeviceBeaconUpsertPayload,
): Promise<UpsertDeviceBeaconResult> {
  const { error } = await supabase.from('user_device_beacons').upsert(
    {
      profile_id: payload.profile_id,
      device_id: payload.device_id,
      fcm_token: payload.fcm_token,
      push_enabled: payload.push_enabled,
      platform: payload.platform,
      operating_system: payload.operating_system,
      os_version: payload.os_version,
      manufacturer: payload.manufacturer,
      model: payload.model,
      web_view_version: payload.web_view_version,
      device_name: payload.device_name,
      is_virtual: payload.is_virtual,
      android_sdk_version: payload.android_sdk_version,
      ios_version: payload.ios_version,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,device_id' },
  )

  if (error) {
    logger.error('device_beacon_upsert_error', {
      error: error.message,
      profileId: payload.profile_id,
      deviceId: payload.device_id,
    })
    return { error: error.message }
  }

  return { error: null }
}

export interface DeleteDeviceBeaconResult {
  error: string | null
}

export async function deleteDeviceBeacon(
  profileId: string,
  deviceId: string,
): Promise<DeleteDeviceBeaconResult> {
  const { error } = await supabase
    .from('user_device_beacons')
    .delete()
    .eq('profile_id', profileId)
    .eq('device_id', deviceId)

  if (error) {
    logger.error('device_beacon_delete_error', {
      error: error.message,
      profileId,
      deviceId,
    })
    return { error: error.message }
  }

  return { error: null }
}
