import { Capacitor, CapacitorHttp } from '@capacitor/core'

import { logger } from '@/lib/logger'
import { supabase, getSupabaseAnonKey } from '@/lib/supabase/client'

import { upsertDeviceBeacon } from '../api/deviceBeacon.api'
import type { DeviceBeaconUpsertPayload } from '../types/deviceBeacon.types'
import { LOCATION_SYNC_DEBOUNCE_MS } from '../types/deviceBeacon.types'
import { collectDeviceBeaconPayload } from './collectDeviceBeaconPayload'

export interface ProviderLocationSample {
  latitude: number
  longitude: number
  accuracyMeters: number | null
  recordedAt: string
}

interface PendingLocationSync {
  profileId: string
  sample: ProviderLocationSample
}

const debounceState = {
  lastSyncedAt: 0,
  timerId: null as ReturnType<typeof setTimeout> | null,
  pending: null as PendingLocationSync | null,
  inFlight: false,
}

const latestSamples = new Map<string, ProviderLocationSample>()
const locationSampleListeners = new Set<
  (profileId: string, sample: ProviderLocationSample) => void
>()

export function getLatestProviderLocationSample(
  profileId: string,
): ProviderLocationSample | null {
  return latestSamples.get(profileId) ?? null
}

export function subscribeProviderLocationSamples(
  listener: (profileId: string, sample: ProviderLocationSample) => void,
): () => void {
  locationSampleListeners.add(listener)
  return () => {
    locationSampleListeners.delete(listener)
  }
}

function rememberLocationSample(profileId: string, sample: ProviderLocationSample): void {
  latestSamples.set(profileId, sample)
  for (const listener of locationSampleListeners) {
    listener(profileId, sample)
  }
}

function buildLocationEwkt(latitude: number, longitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`
}

function shouldUseCapacitorHttp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function upsertBeaconViaCapacitorHttp(
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

async function upsertBeaconLocation(payload: DeviceBeaconUpsertPayload): Promise<{ error: string | null }> {
  if (shouldUseCapacitorHttp()) {
    const accessToken = await getAccessToken()
    if (accessToken) {
      const httpResult = await upsertBeaconViaCapacitorHttp(payload, accessToken)
      if (!httpResult.error) {
        return httpResult
      }
      logger.warn('provider_location_sync_http_fallback', { reason: httpResult.error })
    }
  }

  const { error } = await upsertDeviceBeacon(payload)
  return { error }
}

async function flushPendingLocationSync(): Promise<void> {
  if (debounceState.inFlight || !debounceState.pending) {
    return
  }

  const pending = debounceState.pending
  debounceState.pending = null
  debounceState.timerId = null
  debounceState.inFlight = true

  try {
    const basePayload = await collectDeviceBeaconPayload(pending.profileId, {
      role: 'provider',
      locationSample: pending.sample,
    })
    const payload: DeviceBeaconUpsertPayload = basePayload

    const { error } = await upsertBeaconLocation(payload)
    if (error) {
      logger.warn('provider_location_sync_failed', {
        profileId: pending.profileId,
        reason: error,
      })
      debounceState.pending = pending
      scheduleLocationBeaconSync(pending.profileId, pending.sample)
      return
    }

    debounceState.lastSyncedAt = Date.now()
  } finally {
    debounceState.inFlight = false
  }
}

export function scheduleLocationBeaconSync(
  profileId: string,
  sample: ProviderLocationSample,
): void {
  rememberLocationSample(profileId, sample)
  debounceState.pending = { profileId, sample }

  if (debounceState.timerId) {
    clearTimeout(debounceState.timerId)
  }

  const elapsed = Date.now() - debounceState.lastSyncedAt
  const delay = Math.max(0, LOCATION_SYNC_DEBOUNCE_MS - elapsed)

  debounceState.timerId = setTimeout(() => {
    void flushPendingLocationSync()
  }, delay)
}

export async function flushLocationBeaconSyncNow(): Promise<void> {
  if (debounceState.timerId) {
    clearTimeout(debounceState.timerId)
    debounceState.timerId = null
  }
  await flushPendingLocationSync()
}

export async function syncProviderBeaconNow(profileId: string): Promise<void> {
  const sample = getLatestProviderLocationSample(profileId)
  const payload = await collectDeviceBeaconPayload(profileId, {
    role: 'provider',
    locationSample: sample,
  })

  const { error } = await upsertBeaconLocation(payload)
  if (error) {
    logger.warn('provider_beacon_permission_sync_failed', {
      profileId,
      reason: error,
    })
  }
}

export function resetLocationBeaconSyncState(): void {
  if (debounceState.timerId) {
    clearTimeout(debounceState.timerId)
  }
  debounceState.timerId = null
  debounceState.pending = null
  debounceState.inFlight = false
  debounceState.lastSyncedAt = 0
  latestSamples.clear()
}

/** @internal test helper */
export function __getLocationSyncDebounceStateForTests() {
  return debounceState
}
