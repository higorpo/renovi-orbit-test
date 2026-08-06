import { useAuth } from '@/features/auth'
import { logger } from '@/lib/logger'
import {
  markPushPermissionPromptFlowComplete,
  markPushPermissionPromptFlowStarted,
  waitForProviderLocationPermissionFlow,
} from '@/lib/appOpenOverlaySequence'
import {
  getPushPermissionStatus,
  isPushPermissionPending,
  setupPushNotifications,
} from '@/lib/push'
import { useCallback, useEffect, useState } from 'react'

import {
  clearPushPermissionPromptDismissed,
  isPushPermissionPromptDismissed,
  markPushPermissionPromptDismissed,
} from '../utils/pushPermissionPrompt.storage'

const PROMPT_OPEN_DELAY_MS = 600
/** Lets the in-app dialog dismiss before the Android system permission sheet opens. */
const DISMISS_BEFORE_SYSTEM_PROMPT_MS = 320

export function usePushPermissionPrompt() {
  const { user, profile, loadingSession } = useAuth()
  const [open, setOpen] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const isProvider = profile?.role === 'provider'

  const finishPushFlow = useCallback(() => {
    markPushPermissionPromptFlowComplete()
  }, [])

  const evaluatePrompt = useCallback(async () => {
    if (!user?.id) {
      setOpen(false)
      finishPushFlow()
      return
    }

    if (isProvider) {
      await waitForProviderLocationPermissionFlow()
    }

    const status = await getPushPermissionStatus()
    if (!isPushPermissionPending(status)) {
      if (status === 'granted') {
        await clearPushPermissionPromptDismissed()
      }
      setOpen(false)
      finishPushFlow()
      return
    }

    if (await isPushPermissionPromptDismissed()) {
      setOpen(false)
      finishPushFlow()
      return
    }

    setOpen(true)
  }, [finishPushFlow, isProvider, user?.id])

  useEffect(() => {
    if (loadingSession || !user?.id) {
      setOpen(false)
      if (!loadingSession && !user?.id) {
        finishPushFlow()
      }
      return
    }

    // Mark started before the delay so later overlays can await this flow.
    markPushPermissionPromptFlowStarted()

    const timeout = window.setTimeout(() => {
      void evaluatePrompt()
    }, PROMPT_OPEN_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [user?.id, loadingSession, evaluatePrompt, finishPushFlow])

  const dismiss = useCallback(() => {
    void markPushPermissionPromptDismissed()
    setOpen(false)
    finishPushFlow()
  }, [finishPushFlow])

  const acceptAndRequestPermission = useCallback(async () => {
    setRequesting(true)
    setOpen(false)

    await new Promise((resolve) => {
      window.setTimeout(resolve, DISMISS_BEFORE_SYSTEM_PROMPT_MS)
    })

    try {
      const result = await setupPushNotifications(undefined, { requestPermission: true })

      if (result.permission === 'granted') {
        await clearPushPermissionPromptDismissed()
      } else {
        await markPushPermissionPromptDismissed()
      }
    } catch (error) {
      logger.warn('push_permission_request_failed', {
        message: error instanceof Error ? error.message : String(error),
      })
      await markPushPermissionPromptDismissed()
    } finally {
      setRequesting(false)
      finishPushFlow()
    }
  }, [finishPushFlow])

  return {
    open,
    requesting,
    userRole: profile?.role ?? null,
    setOpen,
    dismiss,
    acceptAndRequestPermission,
  }
}
