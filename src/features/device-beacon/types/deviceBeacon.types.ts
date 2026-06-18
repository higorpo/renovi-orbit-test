export const DEVICE_BEACON_SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export const DEVICE_BEACON_SYNC_STORAGE_KEY = 'orbit_device_beacon_last_sync_v1'

/** Minimum interval between beacon location upserts (Req 12 AC13). */
export const LOCATION_SYNC_DEBOUNCE_MS = 60_000

/** Native background geolocation movement threshold in meters (Req 12 AC11). */
export const LOCATION_DISTANCE_FILTER_METERS = 350

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
  location_permission_granted?: boolean
  latitude?: number | null
  longitude?: number | null
  location_accuracy_meters?: number | null
  location_recorded_at?: string | null
}

export interface DeviceBeacon {
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
  location_permission_granted: boolean
  location: unknown | null
  location_accuracy_meters: number | null
  location_recorded_at: string | null
  created_at: string
  updated_at: string
}

export interface DeviceBeaconSyncSnapshot {
  profileId: string
  deviceId: string
  lastSyncedAt: string
  pushEnabled: boolean
  fcmToken: string | null
  locationPermissionGranted?: boolean
  locationRecordedAt?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface UpsertDeviceBeaconResult {
  beacon: DeviceBeacon | null
  error: string | null
}
