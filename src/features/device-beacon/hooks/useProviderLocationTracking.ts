import { useAuth } from '@/features/auth'
import { logger } from '@/lib/logger'
import { useEffect } from 'react'

import {
  startProviderLocationTracking,
  stopProviderLocationTracking,
} from '../utils/providerLocationTracking.runtime'

function isProviderTrackingPaused(
  profile: { operational_status?: string } | null | undefined,
): boolean {
  return profile?.operational_status === 'suspended'
}

export function useProviderLocationTracking(): void {
  const { user, profile, loadingSession } = useAuth()

  useEffect(() => {
    if (loadingSession) {
      return
    }

    const profileId = user?.id ?? null
    const isProvider = profile?.role === 'provider'
    const shouldTrack =
      Boolean(profileId) &&
      isProvider &&
      !isProviderTrackingPaused(profile)

    if (!shouldTrack || !profileId) {
      void stopProviderLocationTracking()
      return
    }

    logger.info('provider_location_tracking_started', { profileId })
    void startProviderLocationTracking(profileId)

    return () => {
      logger.info('provider_location_tracking_stopped', { profileId })
      void stopProviderLocationTracking()
    }
  }, [user?.id, profile?.role, profile?.operational_status, loadingSession])
}
