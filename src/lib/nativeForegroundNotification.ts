import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

import { logger } from './logger'
import { notificationIdForForegroundPayload } from './pushForegroundNotificationId'
import type { PushNotificationPayload } from './push'

export { notificationIdForForegroundPayload } from './pushForegroundNotificationId'

export const NATIVE_FOREGROUND_PUSH_CHANNEL_ID = 'orbit-foreground-push'

/** Android drawable names (see android/app/src/main/res/drawable). */
export const ANDROID_NOTIFICATION_SMALL_ICON = 'ic_notification'
export const ANDROID_NOTIFICATION_LARGE_ICON = 'ic_notification_large'
export const ANDROID_NOTIFICATION_ICON_COLOR = '#1a5f7a'

let channelReady = false

export function resetNativeForegroundNotificationForTests(): void {
  channelReady = false
}

export async function ensureNativeForegroundNotificationChannel(): Promise<void> {
  if (channelReady || Capacitor.getPlatform() !== 'android') {
    channelReady = true
    return
  }

  await LocalNotifications.createChannel({
    id: NATIVE_FOREGROUND_PUSH_CHANNEL_ID,
    name: 'Notificações',
    importance: 5,
    visibility: 1,
  })
  channelReady = true
}

/**
 * Aligns Local Notifications permission with the push permission flow.
 * Request only from setupNativePush when the user explicitly opts in (requestPermission).
 */
export async function syncNativeLocalNotificationPermission(options: {
  requestIfNeeded: boolean
}): Promise<boolean> {
  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true

  if (!options.requestIfNeeded) return false

  const requested = await LocalNotifications.requestPermissions()
  return requested.display === 'granted'
}

export async function showNativeForegroundLocalNotification(
  payload: PushNotificationPayload,
  content: { title: string; body: string; tag: string },
): Promise<void> {
  await ensureNativeForegroundNotificationChannel()

  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') {
    logger.debug('[PUSH] skipping foreground local notification (permission not granted)')
    return
  }

  const isAndroid = Capacitor.getPlatform() === 'android'

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationIdForForegroundPayload(payload),
        title: content.title,
        body: content.body,
        channelId: isAndroid ? NATIVE_FOREGROUND_PUSH_CHANNEL_ID : undefined,
        group: content.tag,
        extra: payload.data,
        ...(isAndroid
          ? {
              smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
              largeIcon: ANDROID_NOTIFICATION_LARGE_ICON,
              iconColor: ANDROID_NOTIFICATION_ICON_COLOR,
            }
          : {}),
      },
    ],
  })
}
