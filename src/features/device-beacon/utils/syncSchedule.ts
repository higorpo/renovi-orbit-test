import {
  DEVICE_BEACON_SYNC_INTERVAL_MS,
  DEVICE_BEACON_SYNC_STORAGE_KEY,
  type DeviceBeaconSyncSnapshot,
  type DeviceBeaconUpsertPayload,
} from '../types/deviceBeacon.types'

function readAllSnapshots(): DeviceBeaconSyncSnapshot[] {
  try {
    const raw = localStorage.getItem(DEVICE_BEACON_SYNC_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as DeviceBeaconSyncSnapshot[]) : []
  } catch {
    return []
  }
}

function writeAllSnapshots(snapshots: DeviceBeaconSyncSnapshot[]): void {
  localStorage.setItem(DEVICE_BEACON_SYNC_STORAGE_KEY, JSON.stringify(snapshots))
}

export function getDeviceBeaconSyncSnapshot(
  profileId: string,
  deviceId: string,
): DeviceBeaconSyncSnapshot | null {
  return readAllSnapshots().find((s) => s.profileId === profileId && s.deviceId === deviceId) ?? null
}

export function saveDeviceBeaconSyncSnapshot(
  payload: DeviceBeaconUpsertPayload,
): DeviceBeaconSyncSnapshot {
  const snapshot: DeviceBeaconSyncSnapshot = {
    profileId: payload.profile_id,
    deviceId: payload.device_id,
    lastSyncedAt: new Date().toISOString(),
    pushEnabled: payload.push_enabled,
    fcmToken: payload.fcm_token,
  }

  const rest = readAllSnapshots().filter(
    (s) => !(s.profileId === snapshot.profileId && s.deviceId === snapshot.deviceId),
  )
  writeAllSnapshots([...rest, snapshot])
  return snapshot
}

export function removeDeviceBeaconSyncSnapshot(profileId: string, deviceId: string): void {
  const rest = readAllSnapshots().filter(
    (s) => !(s.profileId === profileId && s.deviceId === deviceId),
  )
  writeAllSnapshots(rest)
}

export function shouldSyncDeviceBeacon(
  snapshot: DeviceBeaconSyncSnapshot | null,
  payload: DeviceBeaconUpsertPayload,
  force: boolean,
): boolean {
  if (force) return true
  if (!snapshot) return true

  if (snapshot.pushEnabled !== payload.push_enabled) return true
  if (snapshot.fcmToken !== payload.fcm_token) return true

  const elapsed = Date.now() - new Date(snapshot.lastSyncedAt).getTime()
  return elapsed >= DEVICE_BEACON_SYNC_INTERVAL_MS
}
