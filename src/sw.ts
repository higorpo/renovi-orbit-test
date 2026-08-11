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
import { NetworkOnly } from 'workbox-strategies'

import { getFirebaseClientConfig } from './lib/firebase/config'
import { pushNotificationCollapseKey } from './lib/pushCollapseKey'
import {
  buildPushNavigateMessage,
  resolvePushNotificationPath,
} from './lib/pushNavigation'

declare let self: ServiceWorkerGlobalScope

// self.__WB_MANIFEST is the default injection point
precacheAndRoute(self.__WB_MANIFEST)

// clean old assets
cleanupOutdatedCaches()

// Connectivity probe must always hit the network (never precache or cache-first).
registerRoute(
  ({ url }) => url.pathname === '/online-check.txt',
  new NetworkOnly(),
)

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
    const title = payload.notification?.title ?? payload.data?.title ?? 'Prestway'
    const body = payload.notification?.body ?? payload.data?.body ?? ''
    const tag = pushNotificationCollapseKey(
      {
        title,
        body,
        data: payload.data as Record<string, string> | undefined,
      },
      payload.messageId ?? 'prestway-push',
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

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification
  notification.close()

  const data = notification.data as Record<string, string> | undefined
  const path = resolvePushNotificationPath({
    title: notification.title,
    body: notification.body,
    data,
  })

  if (!path) return

  const absoluteUrl = new URL(path, self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (!('focus' in client)) continue
          client.postMessage(buildPushNavigateMessage(path))
          return client.focus()
        }
        return self.clients.openWindow(absoluteUrl)
      }),
  )
})
