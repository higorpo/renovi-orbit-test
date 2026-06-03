/// <reference lib="webworker" />
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'

import { getFirebaseClientConfig } from './lib/firebase/config'
import { pushNotificationCollapseKey } from './lib/pushCollapseKey'

declare let self: ServiceWorkerGlobalScope

// self.__WB_MANIFEST is the default injection point
precacheAndRoute(self.__WB_MANIFEST)

// clean old assets
cleanupOutdatedCaches()

let allowlist: RegExp[] | undefined
// in dev mode, we disable precaching to avoid caching issues
if (import.meta.env.DEV) allowlist = [/^\/$/]

// to allow work offline
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), { allowlist })
)

self.skipWaiting()
clientsClaim()

const firebaseConfig = getFirebaseClientConfig()
if (firebaseConfig) {
  const firebaseApp = initializeApp(firebaseConfig)
  const messaging = getMessaging(firebaseApp)

  onBackgroundMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? payload.data?.title ?? 'Renovi'
    const body = payload.notification?.body ?? payload.data?.body ?? ''
    const tag = pushNotificationCollapseKey(
      {
        title,
        body,
        data: payload.data as Record<string, string> | undefined,
      },
      payload.messageId ?? 'renovi-push',
    )

    return self.registration.showNotification(title, {
      body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag,
      data: payload.data,
    })
  })
}
