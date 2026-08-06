import { useAuth } from '@/features/auth'
import { useAnalytics } from '@/hooks/useAnalytics'
import { logger } from '@/lib/logger'
import {
  markProviderLocationPermissionFlowComplete,
  markProviderLocationPermissionFlowStarted,
  resetAppOpenOverlaySequence,
} from '@/lib/appOpenOverlaySequence'
import { useCallback, useEffect, useState } from 'react'

import {
  getStoredLocationPermissionGranted,
  isLocationPromptSeen,
  markLocationPromptSeen,
  setStoredLocationPermissionGranted,
} from '../utils/locationPermissionPrompt.storage'
import {
  flushLocationBeaconSyncNow,
  scheduleLocationBeaconSync,
  syncProviderBeaconNow,
} from '../utils/locationSync'
import { startProviderLocationTracking } from '../utils/providerLocationTracking.runtime'
import {
  captureOperationalLocationFix,
  getOperationalLocationPermissionStatus,
  requestOperationalLocationPermission,
} from '../utils/requestOperationalLocationPermission'

const PROMPT_OPEN_DELAY_MS = 600
const DISMISS_BEFORE_SYSTEM_PROMPT_MS = 320

async function syncGrantedLocationBeacon(
  profileId: string,
  latitude?: number,
  longitude?: number,
  accuracyMeters?: number | null,
): Promise<void> {
  if (latitude != null && longitude != null) {
    scheduleLocationBeaconSync(profileId, {
      latitude,
      longitude,
      accuracyMeters: accuracyMeters ?? null,
      recordedAt: new Date().toISOString(),
    })
    await flushLocationBeaconSyncNow()
    return
  }

  const fix = await captureOperationalLocationFix()
  if (fix?.granted && fix.latitude != null && fix.longitude != null) {
    scheduleLocationBeaconSync(profileId, {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracyMeters: fix.accuracyMeters ?? null,
      recordedAt: new Date().toISOString(),
    })
    await flushLocationBeaconSyncNow()
    return
  }

  await syncProviderBeaconNow(profileId)
}

export function useLocationPermissionDialog() {
  const { user, profile, loadingSession } = useAuth()
  const { trackEvent } = useAnalytics()
  const [open, setOpen] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const isProvider = profile?.role === 'provider'

  useEffect(() => {
    return () => {
      resetAppOpenOverlaySequence()
    }
  }, [user?.id])

  const finishLocationPermissionFlow = useCallback(() => {
    markProviderLocationPermissionFlowComplete()
  }, [])

  const evaluatePrompt = useCallback(async () => {
    if (!user?.id || !isProvider) {
      setOpen(false)
      return
    }

    markProviderLocationPermissionFlowStarted()

    const status = await getOperationalLocationPermissionStatus()
    if (status === 'granted') {
      await markLocationPromptSeen()
      await setStoredLocationPermissionGranted(true)
      setOpen(false)
      finishLocationPermissionFlow()
      return
    }

    if (status === 'denied') {
      await markLocationPromptSeen()
      await setStoredLocationPermissionGranted(false)
      setOpen(false)
      finishLocationPermissionFlow()
      return
    }

    if (status === 'unsupported') {
      setOpen(false)
      finishLocationPermissionFlow()
      return
    }

    const storedGranted = await getStoredLocationPermissionGranted()
    if (storedGranted === false && (await isLocationPromptSeen())) {
      setOpen(false)
      finishLocationPermissionFlow()
      return
    }

    if (await isLocationPromptSeen()) {
      setOpen(false)
      finishLocationPermissionFlow()
      return
    }

    setOpen(true)
  }, [finishLocationPermissionFlow, isProvider, user?.id])

  useEffect(() => {
    if (loadingSession || !user?.id || !isProvider) {
      setOpen(false)
      return
    }

    const timeout = window.setTimeout(() => {
      void evaluatePrompt()
    }, PROMPT_OPEN_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [user?.id, loadingSession, isProvider, evaluatePrompt])

  const dismiss = useCallback(async () => {
    await markLocationPromptSeen()
    await setStoredLocationPermissionGranted(false)
    if (user?.id) {
      await syncProviderBeaconNow(user.id)
    }
    trackEvent('location_permission_denied', { user_role: 'provider', source: 'explainer_decline' })
    setOpen(false)
    finishLocationPermissionFlow()
  }, [finishLocationPermissionFlow, trackEvent, user?.id])

  const acceptAndRequestPermission = useCallback(async () => {
    setRequesting(true)
    setOpen(false)

    await new Promise((resolve) => {
      window.setTimeout(resolve, DISMISS_BEFORE_SYSTEM_PROMPT_MS)
    })

    try {
      const result = await requestOperationalLocationPermission()
      await markLocationPromptSeen()

      if (result.granted) {
        await setStoredLocationPermissionGranted(true)

        if (user?.id) {
          await syncGrantedLocationBeacon(
            user.id,
            result.latitude,
            result.longitude,
            result.accuracyMeters,
          )
          await startProviderLocationTracking(user.id)
        }

        trackEvent('location_permission_granted', {
          user_role: 'provider',
          source: 'explainer_confirm',
        })
      } else if (result.status === 'denied') {
        await setStoredLocationPermissionGranted(false)

        if (user?.id) {
          await syncProviderBeaconNow(user.id)
        }

        trackEvent('location_permission_denied', {
          user_role: 'provider',
          source: 'explainer_confirm',
        })
      } else {
        trackEvent('location_permission_denied', {
          user_role: 'provider',
          source: 'explainer_confirm_pending',
        })
      }
    } catch (error) {
      logger.warn('location_permission_request_failed', {
        message: error instanceof Error ? error.message : String(error),
      })
      await markLocationPromptSeen()
      trackEvent('location_permission_denied', {
        user_role: 'provider',
        source: 'explainer_confirm_error',
      })
    } finally {
      setRequesting(false)
      finishLocationPermissionFlow()
    }
  }, [finishLocationPermissionFlow, trackEvent, user?.id])

  return {
    open,
    requesting,
    setOpen,
    dismiss,
    acceptAndRequestPermission,
  }
}
