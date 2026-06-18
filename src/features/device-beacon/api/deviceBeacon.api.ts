import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

import type {
  DeviceBeacon,
  DeviceBeaconUpsertPayload,
  UpsertDeviceBeaconResult,
} from '../types/deviceBeacon.types'
import { latLngToH3BigInt } from '../utils/matchingH3'

function buildLocationEwkt(latitude: number, longitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`
}

function hasValidLocation(payload: DeviceBeaconUpsertPayload): boolean {
  return (
    payload.location_permission_granted === true &&
    payload.latitude != null &&
    payload.longitude != null &&
    Number.isFinite(payload.latitude) &&
    Number.isFinite(payload.longitude)
  )
}

function buildLocationFields(payload: DeviceBeaconUpsertPayload) {
  const locationPermissionGranted = payload.location_permission_granted ?? false

  if (!hasValidLocation(payload)) {
    return {
      location_permission_granted: locationPermissionGranted,
      location: null,
      location_accuracy_meters: null,
      location_recorded_at: null,
      h3_index: null,
    }
  }

  const h3Index = latLngToH3BigInt(payload.latitude!, payload.longitude!)

  return {
    location_permission_granted: true,
    location: buildLocationEwkt(payload.latitude!, payload.longitude!),
    location_accuracy_meters: payload.location_accuracy_meters ?? null,
    location_recorded_at: payload.location_recorded_at ?? null,
    h3_index: h3Index != null ? h3Index.toString() : null,
  }
}

export async function upsertDeviceBeacon(
  payload: DeviceBeaconUpsertPayload,
): Promise<UpsertDeviceBeaconResult> {
  const { data, error } = await supabase
    .from('user_device_beacons')
    .upsert(
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
        ...buildLocationFields(payload),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,device_id' },
    )
    .select()
    .single()

  if (error) {
    logger.error('device_beacon_upsert_error', {
      error: error.message,
      profileId: payload.profile_id,
      deviceId: payload.device_id,
    })
    return { beacon: null, error: error.message }
  }

  return { beacon: data as DeviceBeacon, error: null }
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
