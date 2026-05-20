import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'

import {
  getPushRegistrationState,
  type PushRegistrationState,
} from '@/lib/push'

import type { DeviceBeaconUpsertPayload } from '../types/deviceBeacon.types'

export async function collectDeviceBeaconPayload(
  profileId: string,
): Promise<DeviceBeaconUpsertPayload> {
  const [{ identifier }, info, pushState] = await Promise.all([
    Device.getId(),
    Device.getInfo(),
    getPushRegistrationState({ requestPermission: false }),
  ])

  return buildPayload(profileId, identifier, info, pushState)
}

export function buildPayloadFromPushState(
  profileId: string,
  deviceId: string,
  deviceInfo: Awaited<ReturnType<typeof Device.getInfo>>,
  pushState: PushRegistrationState,
): DeviceBeaconUpsertPayload {
  return buildPayload(profileId, deviceId, deviceInfo, pushState)
}

function buildPayload(
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
