import { Capacitor } from '@capacitor/core'
import { BackgroundGeolocation } from '@capgo/background-geolocation'

import type { Location } from '@capgo/background-geolocation'

const GEO_ERR_PERMISSION_DENIED = 1

const WEB_GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 0,
}

const NATIVE_LOCATION_CAPTURE_TIMEOUT_MS = 25_000

export type OperationalLocationPermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported'

export interface RequestOperationalLocationPermissionResult {
  granted: boolean
  status: OperationalLocationPermissionStatus
  latitude?: number
  longitude?: number
  accuracyMeters?: number | null
}

type BackgroundGeolocationPermissionPlugin = {
  checkPermissions?: () => Promise<{ location?: string }>
  requestPermissions?: (options?: { permissions?: string[] }) => Promise<{ location?: string }>
}

function mapNativePermissionState(
  location: string | undefined,
): OperationalLocationPermissionStatus | null {
  if (location === 'granted') return 'granted'
  if (location === 'denied') return 'denied'
  if (location === 'prompt') return 'prompt'
  return null
}

function resultFromNativeLocation(location: Location): RequestOperationalLocationPermissionResult {
  return {
    granted: true,
    status: 'granted',
    latitude: location.latitude,
    longitude: location.longitude,
    accuracyMeters: location.accuracy ?? null,
  }
}

async function getNativeOperationalLocationPermissionStatus(): Promise<
  OperationalLocationPermissionStatus | null
> {
  const plugin = BackgroundGeolocation as typeof BackgroundGeolocation &
    BackgroundGeolocationPermissionPlugin

  if (!plugin.checkPermissions) {
    return null
  }

  try {
    const result = await plugin.checkPermissions()
    return mapNativePermissionState(result.location)
  } catch {
    return null
  }
}

async function requestNativeLocationPermissionOnly(): Promise<OperationalLocationPermissionStatus> {
  const plugin = BackgroundGeolocation as typeof BackgroundGeolocation &
    BackgroundGeolocationPermissionPlugin

  if (!plugin.requestPermissions) {
    return 'unsupported'
  }

  try {
    const result = await plugin.requestPermissions({ permissions: ['location'] })
    return mapNativePermissionState(result.location) ?? 'prompt'
  } catch {
    return 'denied'
  }
}

function captureBrowserGeolocationFix(): Promise<RequestOperationalLocationPermissionResult | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          granted: true,
          status: 'granted',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? null,
        }),
      (error) => {
        if (error.code === GEO_ERR_PERMISSION_DENIED) {
          resolve({ granted: false, status: 'denied' })
          return
        }
        resolve(null)
      },
      WEB_GEO_OPTIONS,
    )
  })
}

/**
 * Reads a location fix through the native geolocation plugin.
 * WebView `navigator.geolocation` is unreliable on Android after Capacitor permission grants.
 */
export function captureNativeOperationalLocationFix(): Promise<RequestOperationalLocationPermissionResult | null> {
  return new Promise((resolve) => {
    let settled = false

    const settle = (result: RequestOperationalLocationPermissionResult | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      void BackgroundGeolocation.stop().catch(() => {})
      resolve(result)
    }

    const timeoutId = window.setTimeout(() => settle(null), NATIVE_LOCATION_CAPTURE_TIMEOUT_MS)

    void BackgroundGeolocation.start(
      {
        backgroundTitle: 'Prestway',
        backgroundMessage: 'Obtendo sua localização.',
        requestPermissions: false,
        stale: true,
        distanceFilter: 0,
      },
      (location, error) => {
        if (settled) return
        if (error) return

        if (location?.latitude != null && location?.longitude != null) {
          settle(resultFromNativeLocation(location))
        }
      },
    ).catch(() => settle(null))
  })
}

async function requestNativeOperationalLocationPermission(): Promise<RequestOperationalLocationPermissionResult> {
  const permissionStatus = await requestNativeLocationPermissionOnly()

  if (permissionStatus === 'unsupported') {
    return { granted: false, status: 'unsupported' }
  }

  if (permissionStatus !== 'granted') {
    return {
      granted: false,
      status: permissionStatus === 'denied' ? 'denied' : 'prompt',
    }
  }

  const fix = await captureNativeOperationalLocationFix()
  if (fix?.granted && fix.latitude != null && fix.longitude != null) {
    return fix
  }

  return { granted: true, status: 'granted' }
}

export async function getOperationalLocationPermissionStatus(): Promise<OperationalLocationPermissionStatus> {
  if (Capacitor.isNativePlatform()) {
    const nativeStatus = await getNativeOperationalLocationPermissionStatus()
    if (nativeStatus) {
      return nativeStatus
    }
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'unsupported'
  }

  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
      if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
        return status.state
      }
    } catch {
      // Permissions API may be unavailable on some WebViews.
    }
  }

  return 'prompt'
}

export async function captureOperationalLocationFix(): Promise<RequestOperationalLocationPermissionResult | null> {
  if (Capacitor.isNativePlatform()) {
    return captureNativeOperationalLocationFix()
  }

  return captureBrowserGeolocationFix()
}

export function requestOperationalLocationPermission(): Promise<RequestOperationalLocationPermissionResult> {
  if (Capacitor.isNativePlatform()) {
    return requestNativeOperationalLocationPermission()
  }

  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ granted: false, status: 'unsupported' })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          granted: true,
          status: 'granted',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? null,
        }),
      (error) => {
        const denied = error.code === GEO_ERR_PERMISSION_DENIED
        resolve({
          granted: false,
          status: denied ? 'denied' : 'prompt',
        })
      },
      WEB_GEO_OPTIONS,
    )
  })
}
