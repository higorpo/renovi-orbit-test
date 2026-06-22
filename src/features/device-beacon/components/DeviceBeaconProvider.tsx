import { useAuth } from '@/features/auth'
import { logger } from '@/lib/logger'
import {
  setupPushNotifications,
  subscribePushRegistrationState,
} from '@/lib/push'
import { useCallback, useEffect, useRef } from 'react'

import { upsertDeviceBeacon } from '../api/deviceBeacon.api'
import {
  collectDeviceBeaconPayload,
  type CollectDeviceBeaconContext,
} from '../utils/collectDeviceBeaconPayload'
import { getLatestProviderLocationSample } from '../utils/locationSync'
import {
  getDeviceBeaconSyncSnapshot,
  saveDeviceBeaconSyncSnapshot,
  shouldSyncDeviceBeacon,
} from '../utils/syncSchedule'
import { ProviderLocationProvider } from './ProviderLocationProvider'

function hasBeaconLocation(payload: Awaited<ReturnType<typeof collectDeviceBeaconPayload>>): boolean {
  return payload.latitude != null && payload.longitude != null
}

async function syncDeviceBeaconForUser(
  profileId: string,
  force: boolean,
  context: CollectDeviceBeaconContext,
): Promise<void> {
  const payload = await collectDeviceBeaconPayload(profileId, context)
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
    has_location: hasBeaconLocation(payload),
    forced: force,
  })
}

export function DeviceBeaconProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, loadingSession } = useAuth()
  const syncingRef = useRef(false)
  const profileId = user?.id ?? null
  const role = profile?.role ?? null

  const buildContext = useCallback((): CollectDeviceBeaconContext => {
    if (!profileId) {
      return { role }
    }
    return {
      role,
      locationSample: getLatestProviderLocationSample(profileId),
    }
  }, [profileId, role])

  const runSync = useCallback(
    async (force: boolean) => {
      if (!profileId || syncingRef.current) return
      syncingRef.current = true
      try {
        logger.info('device_beacon_sync_started', { profileId, force })
        await syncDeviceBeaconForUser(profileId, force, buildContext())
      } catch (error) {
        logger.warn('device_beacon_sync_failed', {
          profileId,
          message: error instanceof Error ? error.message : String(error),
        })
      } finally {
        syncingRef.current = false
      }
    },
    [profileId, buildContext],
  )

  useEffect(() => {
    if (!profileId || loadingSession) return

    const unsubscribePush = subscribePushRegistrationState(() => {
      void runSync(false)
    })

    void setupPushNotifications(undefined, { requestPermission: false })

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runSync(false)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    void runSync(false)

    return () => {
      unsubscribePush()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [profileId, role, loadingSession, runSync])

  return <ProviderLocationProvider>{children}</ProviderLocationProvider>
}
