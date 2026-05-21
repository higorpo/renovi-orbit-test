import { preferencesGet, preferencesSet } from '@/lib/capacitor/preferencesStorage'
import {
  DEVICE_BEACON_SYNC_INTERVAL_MS,
  DEVICE_BEACON_SYNC_STORAGE_KEY,
  type DeviceBeaconSyncSnapshot,
  type DeviceBeaconUpsertPayload,
} from '../types/deviceBeacon.types'

async function readAllSnapshots(): Promise<DeviceBeaconSyncSnapshot[]> {
  try {
    const raw = await preferencesGet(DEVICE_BEACON_SYNC_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as DeviceBeaconSyncSnapshot[]) : []
  } catch {
    return []
  }
}

async function writeAllSnapshots(snapshots: DeviceBeaconSyncSnapshot[]): Promise<void> {
  await preferencesSet(DEVICE_BEACON_SYNC_STORAGE_KEY, JSON.stringify(snapshots))
}

export async function getDeviceBeaconSyncSnapshot(
  profileId: string,
  deviceId: string,
): Promise<DeviceBeaconSyncSnapshot | null> {
  const snapshots = await readAllSnapshots()
  return snapshots.find((s) => s.profileId === profileId && s.deviceId === deviceId) ?? null
}

export async function saveDeviceBeaconSyncSnapshot(
  payload: DeviceBeaconUpsertPayload,
): Promise<DeviceBeaconSyncSnapshot> {
  const snapshot: DeviceBeaconSyncSnapshot = {
    profileId: payload.profile_id,
    deviceId: payload.device_id,
    lastSyncedAt: new Date().toISOString(),
    pushEnabled: payload.push_enabled,
    fcmToken: payload.fcm_token,
  }

  const snapshots = await readAllSnapshots()
  const rest = snapshots.filter(
    (s) => !(s.profileId === snapshot.profileId && s.deviceId === snapshot.deviceId),
  )
  await writeAllSnapshots([...rest, snapshot])
  return snapshot
}

export async function removeDeviceBeaconSyncSnapshot(
  profileId: string,
  deviceId: string,
): Promise<void> {
  const snapshots = await readAllSnapshots()
  const rest = snapshots.filter(
    (s) => !(s.profileId === profileId && s.deviceId === deviceId),
  )
  await writeAllSnapshots(rest)
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
