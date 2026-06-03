import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from '@capacitor/push-notifications'
import { getToken, onMessage, type MessagePayload } from 'firebase/messaging'

import { recordPushClick } from '@/features/notifications'
import { getFirebaseApp } from './firebase/app'
import { getFirebaseVapidKey, isFirebaseConfigured } from './firebase/config'
import { getFirebaseMessaging } from './firebase/messaging'
import { logger } from './logger'
import {
  ensureNativeForegroundNotificationChannel,
  resetNativeForegroundNotificationForTests,
  showNativeForegroundLocalNotification,
  syncNativeLocalNotificationPermission,
} from './nativeForegroundNotification'
import {
  checkNativeNotificationPermission,
  requestNativeNotificationPermission,
} from './nativeNotificationPermission'
import { pushNotificationCollapseKey } from './pushCollapseKey'
import { handlePushNotificationOpen, resetPushNavigationForTests } from './pushNavigation'
import { resetPushSuppressionForTests, shouldSuppressPushNotification } from './pushSuppression'

export type PushPlatform = 'android' | 'ios' | 'web'

export interface PushNotificationPayload {
  title?: string
  body?: string
  data?: Record<string, string>
}

export interface PushSetupCallbacks {
  onToken?: (token: string, platform: PushPlatform) => void
  onForegroundNotification?: (payload: PushNotificationPayload) => void
}

export type WebPushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

export interface PushSetupOptions {
  /**
   * Web only: call Notification.requestPermission(). Browsers usually require a user
   * gesture (button click); auto-request on page load often returns "denied" without a prompt.
   */
  requestPermission?: boolean
}

export interface PushSetupResult {
  platform: PushPlatform
  token: string | null
  permission?: WebPushPermission | 'prompt'
}

let nativeListenersAttached = false
let webForegroundListenerAttached = false
let cachedNativeFcmToken: string | null = null
let nativeFcmRegisterStarted = false

const NATIVE_FCM_REGISTER_TIMEOUT_MS = 20_000

type NativeFcmTokenWaiter = {
  resolve: (token: string) => void
  reject: (error: Error) => void
}

let nativeFcmTokenWaiters: NativeFcmTokenWaiter[] = []

const PUSH_NOTIFICATION_ICON = '/icon-192.svg'
const DEFAULT_PUSH_NOTIFICATION_TITLE = 'Renovi'
const DEFAULT_PUSH_NOTIFICATION_TAG = 'renovi-push'

const pushStateListeners = new Set<(state: PushRegistrationState) => void>()
let activePushCallbacks: PushSetupCallbacks | undefined

export interface PushRegistrationState {
  platform: PushPlatform | 'web'
  pushEnabled: boolean
  fcmToken: string | null
  permission: WebPushPermission | 'prompt'
}

export function subscribePushRegistrationState(
  listener: (state: PushRegistrationState) => void,
): () => void {
  pushStateListeners.add(listener)
  return () => pushStateListeners.delete(listener)
}

function notifyPushStateListeners(state: PushRegistrationState): void {
  for (const listener of pushStateListeners) {
    listener(state)
  }
}

export function toPushRegistrationState(result: PushSetupResult): PushRegistrationState {
  const pushEnabled = result.permission === 'granted'
  return {
    platform: result.platform,
    pushEnabled,
    fcmToken: pushEnabled ? result.token : null,
    permission: result.permission ?? 'default',
  }
}

export function getWebPushPermission(): WebPushPermission {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export type PushPermissionStatus = WebPushPermission | 'prompt' | 'unsupported'

export function isPushPermissionPending(status: PushPermissionStatus): boolean {
  return status === 'default' || status === 'prompt'
}

/** Reads current permission without requesting or registering for push. */
export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (Capacitor.isNativePlatform()) {
    return checkNativeNotificationPermission()
  }

  if (!('Notification' in window)) return 'unsupported'
  if (!isFirebaseConfigured()) return 'unsupported'

  return getWebPushPermission()
}

function resolveForegroundNotificationContent(payload: PushNotificationPayload): {
  title: string
  body: string
  tag: string
} {
  const title = payload.title?.trim() || DEFAULT_PUSH_NOTIFICATION_TITLE
  const body = payload.body?.trim() ?? ''
  const tag = pushNotificationCollapseKey(payload, DEFAULT_PUSH_NOTIFICATION_TAG)

  return { title, body, tag }
}

/** Shows a system notification while the app is in the foreground (web/PWA only). */
export async function showWebForegroundSystemNotification(
  payload: PushNotificationPayload,
): Promise<void> {
  if (Capacitor.isNativePlatform()) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (!('serviceWorker' in navigator)) return

  const { title, body, tag } = resolveForegroundNotificationContent(payload)

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, {
      body,
      icon: PUSH_NOTIFICATION_ICON,
      badge: PUSH_NOTIFICATION_ICON,
      tag,
      data: payload.data,
    })
  } catch (error) {
    logger.warn('[PUSH] foreground system notification failed (web)', {
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function handleForegroundPushNotification(payload: PushNotificationPayload): void {
  if (shouldSuppressPushNotification(payload)) {
    logger.debug('[PUSH] suppressed for active conversation')
    return
  }

  const content = resolveForegroundNotificationContent(payload)

  if (Capacitor.isNativePlatform()) {
    void showNativeForegroundLocalNotification(payload, content).catch((error) => {
      logger.warn('[PUSH] foreground local notification failed (native)', {
        message: error instanceof Error ? error.message : String(error),
      })
    })
  } else {
    void showWebForegroundSystemNotification(payload)
  }

  activePushCallbacks?.onForegroundNotification?.(payload)
}

export function formatPushNotificationMessage(payload: PushNotificationPayload): string {
  const title = payload.title?.trim() || 'Notificação'
  const body = payload.body?.trim()
  const dataKeys = payload.data ? Object.keys(payload.data) : []

  if (body) {
    return dataKeys.length > 0
      ? `${title}\n\n${body}\n\nDados: ${JSON.stringify(payload.data)}`
      : `${title}\n\n${body}`
  }

  return dataKeys.length > 0 ? `${title}\n\nDados: ${JSON.stringify(payload.data)}` : title
}

function mapCapacitorNotification(notification: PushNotificationSchema): PushNotificationPayload {
  const data: Record<string, string> = {}
  if (notification.data) {
    for (const [key, value] of Object.entries(notification.data)) {
      data[key] = typeof value === 'string' ? value : JSON.stringify(value)
    }
  }

  return {
    title: notification.title ?? undefined,
    body: notification.body ?? undefined,
    data: Object.keys(data).length > 0 ? data : undefined,
  }
}

function mapFirebaseMessage(payload: MessagePayload): PushNotificationPayload {
  const data: Record<string, string> = {}
  if (payload.data) {
    for (const [key, value] of Object.entries(payload.data)) {
      data[key] = typeof value === 'string' ? value : String(value)
    }
  }

  return {
    title: payload.notification?.title ?? data.title,
    body: payload.notification?.body ?? data.body,
    data: Object.keys(data).length > 0 ? data : undefined,
  }
}

async function trackPushClick(dispatchId: string): Promise<void> {
  try {
    await recordPushClick({ dispatchId })
  } catch (err) {
    logger.warn('[PUSH] engagement tracking failed', {
      dispatchId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

function rejectNativeFcmTokenWaiters(error: Error): void {
  for (const waiter of nativeFcmTokenWaiters) {
    waiter.reject(error)
  }
  nativeFcmTokenWaiters = []
}

function resolveNativeFcmTokenWaiters(token: string): void {
  for (const waiter of nativeFcmTokenWaiters) {
    waiter.resolve(token)
  }
  nativeFcmTokenWaiters = []
}

function attachNativeListeners(): void {
  if (nativeListenersAttached) return
  nativeListenersAttached = true

  void PushNotifications.addListener('registration', (token: Token) => {
    cachedNativeFcmToken = token.value
    resolveNativeFcmTokenWaiters(token.value)
  })

  void PushNotifications.addListener('registrationError', (error) => {
    const normalized =
      error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'FCM registration failed')
    logger.error('[PUSH] registration error (native)', { error: normalized.message })
    rejectNativeFcmTokenWaiters(normalized)
  })

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    const payload = mapCapacitorNotification(notification)
    logger.info('[PUSH] foreground received (native)', { payload })
    handleForegroundPushNotification(payload)
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    const payload = mapCapacitorNotification(action.notification)
    const dispatchId = payload.data?.dispatch_id

    const path = handlePushNotificationOpen(payload);

    logger.info('[PUSH] notification action (native)', {
      actionId: action.actionId,
      path,
    })

    if (dispatchId) {
      void trackPushClick(dispatchId)
    }
  })

  void LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const extra = action.notification.extra
    const data: Record<string, string> = {}
    if (extra && typeof extra === 'object') {
      for (const [key, value] of Object.entries(extra)) {
        if (value == null) continue
        data[key] = typeof value === 'string' ? value : String(value)
      }
    }

    const payload: PushNotificationPayload = {
      title: action.notification.title ?? undefined,
      body: action.notification.body ?? undefined,
      data: Object.keys(data).length > 0 ? data : undefined,
    }

    const path = handlePushNotificationOpen(payload);

    logger.info('[PUSH] local notification action (native)', {
      actionId: action.actionId,
      path,
    })

    const dispatchId = data.dispatch_id
    if (dispatchId) {
      void trackPushClick(dispatchId)
    }
  })
}

async function awaitNativeFcmToken(): Promise<string> {
  if (cachedNativeFcmToken) return cachedNativeFcmToken

  if (!nativeFcmRegisterStarted) {
    nativeFcmRegisterStarted = true
    await PushNotifications.register()
  }

  return new Promise<string>((resolve, reject) => {
    const waiter: NativeFcmTokenWaiter = {
      resolve: (token) => {
        window.clearTimeout(timeout)
        nativeFcmTokenWaiters = nativeFcmTokenWaiters.filter((w) => w !== waiter)
        resolve(token)
      },
      reject: (error) => {
        window.clearTimeout(timeout)
        nativeFcmTokenWaiters = nativeFcmTokenWaiters.filter((w) => w !== waiter)
        reject(error)
      },
    }

    const timeout = window.setTimeout(() => {
      nativeFcmTokenWaiters = nativeFcmTokenWaiters.filter((w) => w !== waiter)
      waiter.reject(
        new Error('Não foi possível concluir o registro de push. Verifique a conexão e tente novamente.'),
      )
    }, NATIVE_FCM_REGISTER_TIMEOUT_MS)

    nativeFcmTokenWaiters.push(waiter)
  })
}

async function setupNativePush(
  callbacks?: PushSetupCallbacks,
  options?: PushSetupOptions,
): Promise<PushSetupResult> {
  const platform = Capacitor.getPlatform() as 'android' | 'ios'
  const shouldRequestPermission = options?.requestPermission === true

  let permission = await checkNativeNotificationPermission()

  if (shouldRequestPermission && permission !== 'granted') {
    permission = await requestNativeNotificationPermission()
  }

  if (permission !== 'granted') {
    const result: PushSetupResult = { platform, token: null, permission }
    notifyPushStateListeners(toPushRegistrationState(result))
    return result
  }

  attachNativeListeners()

  await ensureNativeForegroundNotificationChannel()

  if (platform === 'ios') {
    const localNotificationGranted = await syncNativeLocalNotificationPermission({
      requestIfNeeded: shouldRequestPermission,
    })
    if (shouldRequestPermission && !localNotificationGranted) {
      logger.warn('[PUSH] local notification permission not granted after user prompt')
    }
  }

  const token = await awaitNativeFcmToken()
  logger.info('[PUSH] token (native)', { platform })
  callbacks?.onToken?.(token, platform)

  const result: PushSetupResult = { platform, token, permission: 'granted' }
  notifyPushStateListeners(toPushRegistrationState(result))
  return result
}

async function waitForServiceWorkerRegistration(timeoutMs = 15_000): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing?.active) return existing

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(
        new Error(
          'Service worker not ready. Enable PWA (VITE_ENABLE_PWA=true) so Firebase can receive background push.',
        ),
      )
    }, timeoutMs)

    navigator.serviceWorker.ready
      .then((registration) => {
        window.clearTimeout(timeout)
        resolve(registration)
      })
      .catch((error) => {
        window.clearTimeout(timeout)
        reject(error)
      })
  })
}

function attachWebForegroundListener(messaging: ReturnType<typeof getFirebaseMessaging>): void {
  if (webForegroundListenerAttached) return
  webForegroundListenerAttached = true

  onMessage(messaging, (payload) => {
    const mapped = mapFirebaseMessage(payload)
    logger.info('[PUSH] foreground received (web)', { payload: mapped })
    handleForegroundPushNotification(mapped)
  })
}

async function setupWebPush(
  callbacks?: PushSetupCallbacks,
  options?: PushSetupOptions,
): Promise<PushSetupResult> {
  const platform: PushPlatform = 'web'
  const shouldRequestPermission = options?.requestPermission === true

  if (!isFirebaseConfigured()) {
    logger.warn('[PUSH] Firebase web config missing; skipping web push setup')
    return { platform, token: null, permission: 'unsupported' }
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    logger.warn('[PUSH] Notifications or service worker not supported in this browser')
    return { platform, token: null, permission: 'unsupported' }
  }

  const app = getFirebaseApp()
  const messaging = app ? getFirebaseMessaging(app) : null
  const vapidKey = getFirebaseVapidKey()

  if (!app || !messaging || !vapidKey) {
    return { platform, token: null, permission: getWebPushPermission() }
  }

  let permission = Notification.permission

  if (permission === 'default' && shouldRequestPermission) {
    permission = await Notification.requestPermission()
  }

  if (permission === 'default') {
    const result = { platform, token: null, permission: 'default' as const }
    notifyPushStateListeners(toPushRegistrationState(result))
    return result
  }

  if (permission === 'denied') {
    const result = { platform, token: null, permission: 'denied' as const }
    notifyPushStateListeners(toPushRegistrationState(result))
    return result
  }

  const serviceWorkerRegistration = await waitForServiceWorkerRegistration()
  attachWebForegroundListener(messaging)

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  })

  logger.info('[PUSH] token (web)')
  callbacks?.onToken?.(token, platform)

  const result = { platform, token, permission: 'granted' as const }
  notifyPushStateListeners(toPushRegistrationState(result))
  return result
}

export async function getPushRegistrationState(
  options?: PushSetupOptions,
): Promise<PushRegistrationState> {
  const result = await setupPushNotifications(undefined, options)
  return toPushRegistrationState(result)
}

export async function setupPushNotifications(
  callbacks?: PushSetupCallbacks,
  options?: PushSetupOptions,
): Promise<PushSetupResult> {
  activePushCallbacks = callbacks

  if (Capacitor.isNativePlatform()) {
    return setupNativePush(callbacks, options)
  }

  return setupWebPush(callbacks, options)
}

/** Resets module singletons between unit tests. */
export function resetPushModuleStateForTests(): void {
  nativeListenersAttached = false
  webForegroundListenerAttached = false
  cachedNativeFcmToken = null
  nativeFcmRegisterStarted = false
  nativeFcmTokenWaiters = []
  activePushCallbacks = undefined
  pushStateListeners.clear()
  resetPushSuppressionForTests()
  resetPushNavigationForTests()
  resetNativeForegroundNotificationForTests()
}
