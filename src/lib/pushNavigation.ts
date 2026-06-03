import type { PushNotificationPayload } from './push'

export const PUSH_NAVIGATE_MESSAGE_TYPE = 'orbit:push-navigate' as const

export type PushNavigateMessage = {
  type: typeof PUSH_NAVIGATE_MESSAGE_TYPE
  path: string
}

let navigationHandler: ((path: string) => void) | null = null
let pendingPath: string | null = null

/** Accepts relative in-app paths from MMD templates (rejects external URLs). */
export function normalizeDeepLinkPath(deepLink: string): string | null {
  const trimmed = deepLink.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) {
    return null
  }
  return trimmed
}

/** In-app route for a push tap; requires explicit deep_link_path in notification data. */
export function resolvePushNotificationPath(
  payload: PushNotificationPayload,
): string | null {
  const deepLink = payload.data?.deep_link_path?.trim()
  if (!deepLink) return null
  return normalizeDeepLinkPath(deepLink)
}

export function handlePushNotificationOpen(payload: PushNotificationPayload): string | null {
  const path = resolvePushNotificationPath(payload)
  if (!path) return null

  if (navigationHandler) {
    navigationHandler(path)
    return path
  }

  pendingPath = path
  return path
}

export function registerPushNavigationHandler(handler: (path: string) => void): () => void {
  navigationHandler = handler
  if (pendingPath) {
    const path = pendingPath
    pendingPath = null
    handler(path)
  }

  return () => {
    if (navigationHandler === handler) {
      navigationHandler = null
    }
  }
}

export function resetPushNavigationForTests(): void {
  navigationHandler = null
  pendingPath = null
}

export function buildPushNavigateMessage(path: string): PushNavigateMessage {
  return { type: PUSH_NAVIGATE_MESSAGE_TYPE, path }
}
