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
/** Lets the in-app dialog dismiss before the Android system permission sheet opens. */
const DISMISS_BEFORE_SYSTEM_PROMPT_MS = 320

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
    }
  }, [])

  return {
    open,
    requesting,
    userRole: profile?.role ?? null,
    setOpen,
    dismiss,
    acceptAndRequestPermission,
  }
}
