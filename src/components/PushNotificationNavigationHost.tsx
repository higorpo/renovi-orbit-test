import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { logger } from '@/lib/logger'
import {
  PUSH_NAVIGATE_MESSAGE_TYPE,
  registerPushNavigationHandler,
} from '@/lib/pushNavigation'

/**
 * Wires push notification taps to React Router (native, foreground local, and SW postMessage).
 */
export function PushNotificationNavigationHost() {
  const navigate = useNavigate()

  useEffect(() => {
    return registerPushNavigationHandler((path) => {
      logger.info('[PUSH] navigating from notification', { path })
      void navigate(path)
    })
  }, [navigate])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: string } | null
      if (data?.type !== PUSH_NAVIGATE_MESSAGE_TYPE || !data.path) return
      logger.info('[PUSH] navigating from service worker', { path: data.path })
      void navigate(data.path)
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  return null
}
