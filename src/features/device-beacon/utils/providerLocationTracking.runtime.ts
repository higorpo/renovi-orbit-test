import { Capacitor } from '@capacitor/core'
import { BackgroundGeolocation } from '@capgo/background-geolocation'

import { logger } from '@/lib/logger'

import {
  LOCATION_DISTANCE_FILTER_METERS,
} from '../types/deviceBeacon.types'
import {
  getStoredLocationPermissionGranted,
  setStoredLocationPermissionGranted,
} from './locationPermissionPrompt.storage'
import {
  resetLocationBeaconSyncState,
  scheduleLocationBeaconSync,
  type ProviderLocationSample,
} from './locationSync'
import {
  captureNativeOperationalLocationFix,
  getOperationalLocationPermissionStatus,
} from './requestOperationalLocationPermission'
import { flushLocationBeaconSyncNow } from './locationSync'

const GEO_ERR_PERMISSION_DENIED = 1

const WEB_GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20_000,
  maximumAge: 300_000,
}

let nativeTrackingStarted = false
let webWatchId: number | null = null

function sampleFromPosition(
  latitude: number,
  longitude: number,
  accuracyMeters: number | null,
): ProviderLocationSample {
  return {
    latitude,
    longitude,
    accuracyMeters,
    recordedAt: new Date().toISOString(),
  }
}

function handleLocationSample(profileId: string, sample: ProviderLocationSample): void {
  scheduleLocationBeaconSync(profileId, sample)
}

function handlePermissionRevoked(profileId: string): void {
  void setStoredLocationPermissionGranted(false)
  logger.warn('provider_location_tracking_revoked', { profileId })
}

async function seedNativeLocationSample(profileId: string): Promise<void> {
  const fix = await captureNativeOperationalLocationFix()
  if (fix?.latitude == null || fix.longitude == null) {
    return
  }

  handleLocationSample(
    profileId,
    sampleFromPosition(fix.latitude, fix.longitude, fix.accuracyMeters ?? null),
  )
  await flushLocationBeaconSyncNow()
}

async function startNativeTracking(profileId: string): Promise<void> {
  if (nativeTrackingStarted) {
    return
  }

  await seedNativeLocationSample(profileId)

  await BackgroundGeolocation.start(
    {
      backgroundMessage: 'Atualizando sua localização para oportunidades próximas.',
      backgroundTitle: 'Prestway',
      requestPermissions: false,
      stale: false,
      distanceFilter: LOCATION_DISTANCE_FILTER_METERS,
    },
    (location, error) => {
      if (error) {
        if (error.code === 'NOT_AUTHORIZED') {
          handlePermissionRevoked(profileId)
          void stopProviderLocationTracking()
        }
        return
      }

      if (!location) {
        return
      }

      handleLocationSample(
        profileId,
        sampleFromPosition(location.latitude, location.longitude, location.accuracy ?? null),
      )
    },
  )

  nativeTrackingStarted = true
}

function startWebForegroundTracking(profileId: string): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation || webWatchId != null) {
    return
  }

  webWatchId = navigator.geolocation.watchPosition(
    (position) => {
      handleLocationSample(
        profileId,
        sampleFromPosition(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy ?? null,
        ),
      )
    },
    (error) => {
      if (error.code === GEO_ERR_PERMISSION_DENIED) {
        handlePermissionRevoked(profileId)
        stopProviderLocationTracking()
      }
    },
    WEB_GEO_OPTIONS,
  )
}

export async function startProviderLocationTracking(profileId: string): Promise<void> {
  const storedGranted = await getStoredLocationPermissionGranted()
  const status = await getOperationalLocationPermissionStatus()

  if (storedGranted === false || status === 'denied' || status === 'unsupported') {
    return
  }

  if (Capacitor.isNativePlatform()) {
    await startNativeTracking(profileId)
    return
  }

  startWebForegroundTracking(profileId)
}

export async function stopProviderLocationTracking(): Promise<void> {
  if (nativeTrackingStarted) {
    try {
      await BackgroundGeolocation.stop()
    } catch (error) {
      logger.warn('provider_location_tracking_stop_failed', {
        message: error instanceof Error ? error.message : String(error),
      })
    }
    nativeTrackingStarted = false
  }

  if (webWatchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(webWatchId)
    webWatchId = null
  }

  resetLocationBeaconSyncState()
}

export function isProviderLocationTrackingActive(): boolean {
  return nativeTrackingStarted || webWatchId != null
}

/** @internal test helper */
export function __resetProviderLocationTrackingStateForTests(): void {
  nativeTrackingStarted = false
  webWatchId = null
  resetLocationBeaconSyncState()
}
