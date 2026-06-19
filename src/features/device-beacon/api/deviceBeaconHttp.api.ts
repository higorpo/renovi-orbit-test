import { CapacitorHttp } from '@capacitor/core'

import { supabase, getSupabaseAnonKey } from '@/lib/supabase/client'

import type { DeviceBeaconUpsertPayload } from '../types/deviceBeacon.types'

function buildLocationEwkt(latitude: number, longitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`
}

export async function getDeviceBeaconAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function upsertDeviceBeaconViaCapacitorHttp(
  payload: DeviceBeaconUpsertPayload,
  accessToken: string,
): Promise<{ error: string | null }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (typeof supabaseUrl !== 'string' || !supabaseUrl) {
    return { error: 'VITE_SUPABASE_URL is not set' }
  }

  const hasLocation =
    payload.location_permission_granted === true &&
    payload.latitude != null &&
    payload.longitude != null

  const row = {
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
    location_permission_granted: payload.location_permission_granted ?? false,
    location: hasLocation ? buildLocationEwkt(payload.latitude!, payload.longitude!) : null,
    location_accuracy_meters: hasLocation ? (payload.location_accuracy_meters ?? null) : null,
    location_recorded_at: hasLocation ? (payload.location_recorded_at ?? null) : null,
    updated_at: new Date().toISOString(),
  }

  try {
    const response = await CapacitorHttp.post({
      url: `${supabaseUrl.replace(/\/$/, '')}/rest/v1/user_device_beacons?on_conflict=profile_id,device_id`,
      headers: {
        apikey: getSupabaseAnonKey(),
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      data: row,
    })

    if (response.status >= 200 && response.status < 300) {
      return { error: null }
    }

    const message =
      typeof response.data === 'object' && response.data && 'message' in response.data
        ? String((response.data as { message?: string }).message)
        : `HTTP ${response.status}`

    return { error: message }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
