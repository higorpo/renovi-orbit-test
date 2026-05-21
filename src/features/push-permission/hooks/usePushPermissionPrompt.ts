import { useAuth } from '@/features/auth'
import { logger } from '@/lib/logger'
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

export function usePushPermissionPrompt() {
  const { user, profile, loadingSession } = useAuth()
  const [open, setOpen] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const evaluatePrompt = useCallback(async () => {
    if (!user?.id) {
      setOpen(false)
      return
    }

    const status = await getPushPermissionStatus()
    if (!isPushPermissionPending(status)) {
      if (status === 'granted') {
        await clearPushPermissionPromptDismissed()
      }
      setOpen(false)
      return
    }

    if (await isPushPermissionPromptDismissed()) {
      setOpen(false)
      return
    }

    setOpen(true)
  }, [user?.id])

  useEffect(() => {
    if (loadingSession || !user?.id) {
      setOpen(false)
      return
    }

    const timeout = window.setTimeout(() => {
      void evaluatePrompt()
    }, PROMPT_OPEN_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [user?.id, loadingSession, evaluatePrompt])

  const dismiss = useCallback(() => {
    void markPushPermissionPromptDismissed()
    setOpen(false)
  }, [])

  const acceptAndRequestPermission = useCallback(async () => {
    setRequesting(true)
    try {
      await setupPushNotifications(undefined, { requestPermission: true })
      await clearPushPermissionPromptDismissed()
      setOpen(false)
    } catch (error) {
      logger.warn('push_permission_request_failed', {
        message: error instanceof Error ? error.message : String(error),
      })
      await evaluatePrompt()
    } finally {
      setRequesting(false)
    }
  }, [evaluatePrompt])

  return {
    open,
    requesting,
    userRole: profile?.role ?? null,
    setOpen,
    dismiss,
    acceptAndRequestPermission,
  }
}
