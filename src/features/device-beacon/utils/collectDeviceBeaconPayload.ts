import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'

import type { ProfileRole } from '@/features/auth'
import {
  getPushRegistrationState,
  type PushRegistrationState,
} from '@/lib/push'

import type { DeviceBeaconUpsertPayload } from '../types/deviceBeacon.types'
import {
  getLatestProviderLocationSample,
  type ProviderLocationSample,
} from './locationSync'
import { getStoredLocationPermissionGranted } from './locationPermissionPrompt.storage'
import { getOperationalLocationPermissionStatus } from './requestOperationalLocationPermission'

export interface CollectDeviceBeaconContext {
  role?: ProfileRole | null
  locationSample?: ProviderLocationSample | null
}

type LocationPayloadFields = Pick<
  DeviceBeaconUpsertPayload,
  | 'location_permission_granted'
  | 'latitude'
  | 'longitude'
  | 'location_accuracy_meters'
  | 'location_recorded_at'
>

export async function collectDeviceBeaconPayload(
  profileId: string,
  context?: CollectDeviceBeaconContext,
): Promise<DeviceBeaconUpsertPayload> {
  const [{ identifier }, info, pushState] = await Promise.all([
    Device.getId(),
    Device.getInfo(),
    getPushRegistrationState({ requestPermission: false }),
  ])

  return buildPayloadWithLocation(profileId, identifier, info, pushState, context)
}

export async function buildPayloadFromPushState(
  profileId: string,
  deviceId: string,
  deviceInfo: Awaited<ReturnType<typeof Device.getInfo>>,
  pushState: PushRegistrationState,
  context?: CollectDeviceBeaconContext,
): Promise<DeviceBeaconUpsertPayload> {
  return buildPayloadWithLocation(profileId, deviceId, deviceInfo, pushState, context)
}

async function resolveLocationFields(
  profileId: string,
  context?: CollectDeviceBeaconContext,
): Promise<LocationPayloadFields> {
  if (context?.role !== 'provider') {
    return { location_permission_granted: false }
  }

  const storedGranted = await getStoredLocationPermissionGranted()
  const permissionStatus = await getOperationalLocationPermissionStatus()
  const permissionGranted =
    permissionStatus === 'granted' || storedGranted === true

  if (!permissionGranted) {
    return { location_permission_granted: false }
  }

  const sample =
    context?.locationSample ?? getLatestProviderLocationSample(profileId) ?? null

  if (!sample) {
    return { location_permission_granted: true }
  }

  return {
    location_permission_granted: true,
    latitude: sample.latitude,
    longitude: sample.longitude,
    location_accuracy_meters: sample.accuracyMeters,
    location_recorded_at: sample.recordedAt,
  }
}

function buildBasePayload(
  profileId: string,
  deviceId: string,
  info: Awaited<ReturnType<typeof Device.getInfo>>,
  pushState: PushRegistrationState,
): DeviceBeaconUpsertPayload {
  const capacitorPlatform = Capacitor.getPlatform()

  return {
    profile_id: profileId,
    device_id: deviceId,
    fcm_token: pushState.pushEnabled ? pushState.fcmToken : null,
    push_enabled: pushState.pushEnabled,
    platform: capacitorPlatform,
    operating_system: info.operatingSystem ?? null,
    os_version: info.osVersion ?? null,
    manufacturer: info.manufacturer ?? null,
    model: info.model ?? null,
    web_view_version: info.webViewVersion ?? null,
    device_name: info.name ?? null,
    is_virtual: info.isVirtual ?? false,
    android_sdk_version: info.androidSDKVersion ?? null,
    ios_version: info.iOSVersion ?? null,
  }
}

async function buildPayloadWithLocation(
  profileId: string,
  deviceId: string,
  info: Awaited<ReturnType<typeof Device.getInfo>>,
  pushState: PushRegistrationState,
  context?: CollectDeviceBeaconContext,
): Promise<DeviceBeaconUpsertPayload> {
  const locationFields = await resolveLocationFields(profileId, context)
  return {
    ...buildBasePayload(profileId, deviceId, info, pushState),
    ...locationFields,
  }
}
