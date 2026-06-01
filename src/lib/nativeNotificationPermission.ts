import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'

export type NativeNotificationPermission = 'granted' | 'denied' | 'prompt'

export function normalizeNativeNotificationPermission(value: string): NativeNotificationPermission {
  if (value === 'granted') return 'granted'
  if (value === 'denied') return 'denied'
  return 'prompt'
}

/**
 * Android: Local Notifications (POST_NOTIFICATIONS / display). iOS: Push Notifications.
 * Capacitor documents push `checkPermissions` as always granted on Android 12 and below for
 * receiving data; Local Notifications is the correct source for showing banners.
 */
export async function checkNativeNotificationPermission(): Promise<NativeNotificationPermission> {
  if (Capacitor.getPlatform() === 'android') {
    const { display } = await LocalNotifications.checkPermissions()
    return normalizeNativeNotificationPermission(display)
  }

  const { receive } = await PushNotifications.checkPermissions()
  return normalizeNativeNotificationPermission(receive)
}

export async function requestNativeNotificationPermission(): Promise<'granted' | 'denied'> {
  if (Capacitor.getPlatform() === 'android') {
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted' ? 'granted' : 'denied'
  }

  const { receive } = await PushNotifications.requestPermissions()
  return receive === 'granted' ? 'granted' : 'denied'
}
