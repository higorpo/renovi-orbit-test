export const DEVICE_BEACON_SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export const DEVICE_BEACON_SYNC_STORAGE_KEY = 'orbit_device_beacon_last_sync_v1'

export interface DeviceBeaconUpsertPayload {
  profile_id: string
  device_id: string
  fcm_token: string | null
  push_enabled: boolean
  platform: string
  operating_system: string | null
  os_version: string | null
  manufacturer: string | null
  model: string | null
  web_view_version: string | null
  device_name: string | null
  is_virtual: boolean
  android_sdk_version: number | null
  ios_version: number | null
}

export interface DeviceBeaconSyncSnapshot {
  profileId: string
  deviceId: string
  lastSyncedAt: string
  pushEnabled: boolean
  fcmToken: string | null
}

export interface UpsertDeviceBeaconResult {
  error: string | null
}
