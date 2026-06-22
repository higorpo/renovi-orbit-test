import { Capacitor } from '@capacitor/core'

import { logger } from '@/lib/logger'

import { upsertDeviceBeacon } from '../api/deviceBeacon.api'
import {
  getDeviceBeaconAccessToken,
  upsertDeviceBeaconViaCapacitorHttp,
} from '../api/deviceBeaconHttp.api'
import type { DeviceBeaconUpsertPayload } from '../types/deviceBeacon.types'
import { LOCATION_SYNC_DEBOUNCE_MS } from '../types/deviceBeacon.types'
import { collectDeviceBeaconPayload } from './collectDeviceBeaconPayload'
import { saveDeviceBeaconSyncSnapshot } from './syncSchedule'

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

function shouldUseCapacitorHttp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

async function upsertBeaconLocation(payload: DeviceBeaconUpsertPayload): Promise<{ error: string | null }> {
  if (shouldUseCapacitorHttp()) {
    const accessToken = await getDeviceBeaconAccessToken()
    if (accessToken) {
      const httpResult = await upsertDeviceBeaconViaCapacitorHttp(payload, accessToken)
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

    await saveDeviceBeaconSyncSnapshot(payload)
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
