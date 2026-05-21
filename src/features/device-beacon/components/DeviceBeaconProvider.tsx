import { useAuth } from '@/features/auth'
import { logger } from '@/lib/logger'
import {
  setupPushNotifications,
  subscribePushRegistrationState,
  type PushRegistrationState,
} from '@/lib/push'
import { useCallback, useEffect, useRef } from 'react'

import { upsertDeviceBeacon } from '../api/deviceBeacon.api'
import {
  buildPayloadFromPushState,
  collectDeviceBeaconPayload,
} from '../utils/collectDeviceBeaconPayload'
import {
  getDeviceBeaconSyncSnapshot,
  saveDeviceBeaconSyncSnapshot,
  shouldSyncDeviceBeacon,
} from '../utils/syncSchedule'
import { Device } from '@capacitor/device'

async function syncDeviceBeaconForUser(profileId: string, force: boolean): Promise<void> {
  const payload = await collectDeviceBeaconPayload(profileId)
  const snapshot = await getDeviceBeaconSyncSnapshot(profileId, payload.device_id)

  if (!shouldSyncDeviceBeacon(snapshot, payload, force)) {
    return
  }

  const { error } = await upsertDeviceBeacon(payload)
  if (error) {
    logger.warn('device_beacon_sync_skipped', { profileId, reason: error })
    return
  }

  await saveDeviceBeaconSyncSnapshot(payload)
  logger.info('device_beacon_synced', {
    profileId,
    deviceId: payload.device_id,
    pushEnabled: payload.push_enabled,
    forced: force,
  })
}

async function syncFromPushState(
  profileId: string,
  pushState: PushRegistrationState,
  force: boolean,
): Promise<void> {
  const [{ identifier }, info] = await Promise.all([Device.getId(), Device.getInfo()])
  const payload = buildPayloadFromPushState(profileId, identifier, info, pushState)
  const snapshot = await getDeviceBeaconSyncSnapshot(profileId, payload.device_id)

  if (!shouldSyncDeviceBeacon(snapshot, payload, force)) {
    return
  }

  const { error } = await upsertDeviceBeacon(payload)
  if (error) {
    logger.warn('device_beacon_sync_skipped', { profileId, reason: error })
    return
  }

  await saveDeviceBeaconSyncSnapshot(payload)
  logger.info('device_beacon_synced', {
    profileId,
    deviceId: payload.device_id,
    pushEnabled: payload.push_enabled,
    forced: force,
    source: 'push_state',
  })
}

export function DeviceBeaconProvider({ children }: { children: React.ReactNode }) {
  const { user, loadingSession } = useAuth()
  const syncingRef = useRef(false)
  const profileId = user?.id ?? null

  const runSync = useCallback(async (force: boolean) => {
    if (!profileId || syncingRef.current) return
    syncingRef.current = true
    try {
      logger.info('device_beacon_sync_started', { profileId, force })
      await syncDeviceBeaconForUser(profileId, force)
    } catch (error) {
      logger.warn('device_beacon_sync_failed', {
        profileId,
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      syncingRef.current = false
    }
  }, [profileId])

  useEffect(() => {
    if (!profileId || loadingSession) return

    void runSync(false)

    void setupPushNotifications(
      {
        onToken: () => {
          logger.info('fcm_token_updated', { profileId })
          void runSync(true)
        },
      },
      { requestPermission: false },
    )

    const unsubscribe = subscribePushRegistrationState((pushState) => {
      void syncFromPushState(profileId, pushState, true)
    })

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runSync(false)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [profileId, loadingSession, runSync])

  return children
}
