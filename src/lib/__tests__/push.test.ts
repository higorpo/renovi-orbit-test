// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
}))

const pushNotificationsMocks = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  register: vi.fn(),
  addListener: vi.fn(),
}))

const localNotificationsMocks = vi.hoisted(() => ({
  checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
  requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
  createChannel: vi.fn().mockResolvedValue(undefined),
  schedule: vi.fn().mockResolvedValue(undefined),
  addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
}))

const firebaseConfigMocks = vi.hoisted(() => ({
  isFirebaseConfigured: vi.fn(() => true),
  getFirebaseVapidKey: vi.fn(() => 'vapid-key'),
}))

const firebaseAppMocks = vi.hoisted(() => ({
  getFirebaseApp: vi.fn((): { app: boolean } | null => ({ app: true })),
}))

const firebaseMessagingMocks = vi.hoisted(() => ({
  getFirebaseMessaging: vi.fn(() => ({ messaging: true })),
}))

const fcmMocks = vi.hoisted(() => ({
  getToken: vi.fn().mockResolvedValue('web-fcm-token'),
  onMessage: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitorMocks,
}))

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: pushNotificationsMocks,
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: localNotificationsMocks,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const recordPushClickMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/features/notifications', () => ({
  recordPushClick: (...args: unknown[]) => recordPushClickMock(...args),
}))

vi.mock('../firebase/config', () => firebaseConfigMocks)
vi.mock('../firebase/app', () => firebaseAppMocks)
vi.mock('../firebase/messaging', () => firebaseMessagingMocks)
vi.mock('firebase/messaging', () => fcmMocks)

import {
  formatPushNotificationMessage,
  getPushPermissionStatus,
  getPushRegistrationState,
  getWebPushPermission,
  isPushPermissionPending,
  resetPushModuleStateForTests,
  setupPushNotifications,
  showWebForegroundSystemNotification,
  subscribePushRegistrationState,
  toPushRegistrationState,
} from '../push'

function mockServiceWorkerRegistration() {
  const showNotification = vi.fn().mockResolvedValue(undefined)
  const registration = { active: {}, showNotification } as ServiceWorkerRegistration & {
    showNotification: ReturnType<typeof vi.fn>
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    },
    configurable: true,
  })
  return registration
}

describe('push helpers', () => {
  beforeEach(() => {
    resetPushModuleStateForTests()
    vi.clearAllMocks()
    recordPushClickMock.mockResolvedValue(undefined)
    capacitorMocks.isNativePlatform.mockReturnValue(false)
    capacitorMocks.getPlatform.mockReturnValue('web')
    firebaseConfigMocks.isFirebaseConfigured.mockReturnValue(true)
    firebaseConfigMocks.getFirebaseVapidKey.mockReturnValue('vapid-key')
    fcmMocks.getToken.mockResolvedValue('web-fcm-token')
    mockServiceWorkerRegistration()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('isPushPermissionPending', () => {
    it('treats default and prompt as pending', () => {
      expect(isPushPermissionPending('default')).toBe(true)
      expect(isPushPermissionPending('prompt')).toBe(true)
    })

    it('treats granted, denied and unsupported as not pending', () => {
      expect(isPushPermissionPending('granted')).toBe(false)
      expect(isPushPermissionPending('denied')).toBe(false)
      expect(isPushPermissionPending('unsupported')).toBe(false)
    })
  })

  describe('formatPushNotificationMessage', () => {
    it('formats title and body', () => {
      const message = formatPushNotificationMessage({ title: 'Olá', body: 'Mundo' })
      expect(message).toContain('Olá')
      expect(message).toContain('Mundo')
    })

    it('maps firebase message using data fallbacks', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      fcmMocks.onMessage.mockImplementation((_messaging, cb) => {
        cb({
          data: { title: 'Data title', body: 'Data body' },
        })
      })
      const onForeground = vi.fn()
      await setupPushNotifications({ onForegroundNotification: onForeground })
      expect(onForeground).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Data title', body: 'Data body' }),
      )
    })

    it('includes data when present', () => {
      const message = formatPushNotificationMessage({
        title: 'T',
        body: 'B',
        data: { foo: 'bar' },
      })
      expect(message).toContain('Dados:')
      expect(message).toContain('foo')
    })

    it('uses default title and data-only body', () => {
      expect(formatPushNotificationMessage({})).toBe('Notificação')
      expect(formatPushNotificationMessage({ data: { a: '1' } })).toContain('Dados:')
    })
  })

  describe('toPushRegistrationState', () => {
    it('maps granted with token', () => {
      expect(
        toPushRegistrationState({
          platform: 'web',
          token: 'abc',
          permission: 'granted',
        }),
      ).toEqual({
        platform: 'web',
        pushEnabled: true,
        fcmToken: 'abc',
        permission: 'granted',
      })
    })

    it('clears token when not granted', () => {
      expect(
        toPushRegistrationState({
          platform: 'android',
          token: 'abc',
          permission: 'denied',
        }),
      ).toEqual({
        platform: 'android',
        pushEnabled: false,
        fcmToken: null,
        permission: 'denied',
      })
    })
  })

  describe('subscribePushRegistrationState', () => {
    it('notifies listener when setup completes on web granted', async () => {
      const listener = vi.fn()
      subscribePushRegistrationState(listener)

      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })

      await setupPushNotifications()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          pushEnabled: true,
          fcmToken: 'web-fcm-token',
        }),
      )
    })

    it('unsubscribes listener', async () => {
      const listener = vi.fn()
      const unsubscribe = subscribePushRegistrationState(listener)
      unsubscribe()

      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      await setupPushNotifications()

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('getWebPushPermission', () => {
    it('returns unsupported when Notification API is missing', () => {
      // @ts-expect-error testing missing API
      delete globalThis.Notification
      expect(getWebPushPermission()).toBe('unsupported')
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'default' },
        configurable: true,
      })
    })
  })

  describe('getPushPermissionStatus', () => {
    it('returns web permission when not native', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'denied' },
        configurable: true,
      })
      await expect(getPushPermissionStatus()).resolves.toBe('denied')
    })

    it('returns unsupported on web when firebase is not configured', async () => {
      firebaseConfigMocks.isFirebaseConfigured.mockReturnValue(false)
      await expect(getPushPermissionStatus()).resolves.toBe('unsupported')
    })

    it('returns native permission status', async () => {
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      capacitorMocks.getPlatform.mockReturnValue('android')
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'prompt' })
      await expect(getPushPermissionStatus()).resolves.toBe('prompt')
    })
  })

  describe('setupPushNotifications (web)', () => {
    beforeEach(() => {
      Object.defineProperty(globalThis, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: vi.fn().mockResolvedValue('granted'),
        },
        configurable: true,
        writable: true,
      })
    })

    it('returns unsupported when firebase is not configured', async () => {
      firebaseConfigMocks.isFirebaseConfigured.mockReturnValue(false)
      const result = await setupPushNotifications()
      expect(result).toMatchObject({ token: null, permission: 'unsupported' })
    })

    it('returns unsupported when Notification or serviceWorker missing', async () => {
      // @ts-expect-error testing missing API
      delete globalThis.Notification
      const result = await setupPushNotifications()
      expect(result.permission).toBe('unsupported')
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'default', requestPermission: vi.fn() },
        configurable: true,
      })
    })

    it('returns default without requesting when requestPermission is false', async () => {
      const result = await setupPushNotifications(undefined, { requestPermission: false })
      expect(result).toMatchObject({ token: null, permission: 'default' })
    })

    it('requests permission and returns token when granted', async () => {
      const onToken = vi.fn()
      const result = await setupPushNotifications(
        { onToken },
        { requestPermission: true },
      )
      expect(Notification.requestPermission).toHaveBeenCalled()
      expect(result).toMatchObject({
        token: 'web-fcm-token',
        permission: 'granted',
      })
      expect(onToken).toHaveBeenCalledWith('web-fcm-token', 'web')
    })

    it('returns denied without throwing when user refuses permission', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: vi.fn().mockResolvedValue('denied'),
        },
        configurable: true,
      })
      const result = await setupPushNotifications(undefined, { requestPermission: true })
      expect(result).toMatchObject({ token: null, permission: 'denied' })
    })

    it('returns early when firebase app or messaging is missing', async () => {
      firebaseAppMocks.getFirebaseApp.mockReturnValueOnce(null)
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      const result = await setupPushNotifications()
      expect(result.token).toBeNull()
    })

    it('returns denied without throwing when requestPermission is false', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'denied' },
        configurable: true,
      })
      const result = await setupPushNotifications(undefined, { requestPermission: false })
      expect(result.permission).toBe('denied')
    })

    it('invokes foreground callback via onMessage', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      const onForeground = vi.fn()
      fcmMocks.onMessage.mockImplementation((_messaging, cb) => {
        cb({
          notification: { title: 'Hi', body: 'There' },
          data: {},
        })
      })

      await setupPushNotifications({ onForegroundNotification: onForeground })

      expect(onForeground).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Hi', body: 'There' }),
      )
    })

    it('shows a system notification in foreground via service worker', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      const registration = mockServiceWorkerRegistration()

      await showWebForegroundSystemNotification({ title: 'Hi', body: 'There', data: { tag: 'x' } })

      expect(registration.showNotification).toHaveBeenCalledWith(
        'Hi',
        expect.objectContaining({
          body: 'There',
          tag: 'x',
          icon: '/icon-192.svg',
        }),
      )
    })

    it('skips web system notification when permission is not granted', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'denied' },
        configurable: true,
      })
      const registration = mockServiceWorkerRegistration()

      await showWebForegroundSystemNotification({ title: 'Hi', body: 'There' })

      expect(registration.showNotification).not.toHaveBeenCalled()
    })

    it('logs when showing the web system notification fails', async () => {
      const { logger } = await import('../logger')
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            showNotification: vi.fn().mockRejectedValue(new Error('show failed')),
          }),
        },
        configurable: true,
      })

      await showWebForegroundSystemNotification({ title: 'Hi', body: 'There' })

      expect(logger.warn).toHaveBeenCalledWith(
        '[PUSH] foreground system notification failed (web)',
        expect.objectContaining({ message: 'show failed' }),
      )
      mockServiceWorkerRegistration()
    })

    it('skips web system notification on native platforms', async () => {
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      const registration = mockServiceWorkerRegistration()

      await showWebForegroundSystemNotification({ title: 'Hi', body: 'There' })

      expect(registration.showNotification).not.toHaveBeenCalled()
      capacitorMocks.isNativePlatform.mockReturnValue(false)
    })

    it('displays system notification when onMessage fires', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      const registration = mockServiceWorkerRegistration()
      fcmMocks.onMessage.mockImplementation((_messaging, cb) => {
        cb({
          notification: { title: 'Hi', body: 'There' },
          data: { tag: 'msg-1' },
        })
      })

      await setupPushNotifications()

      expect(registration.showNotification).toHaveBeenCalledWith(
        'Hi',
        expect.objectContaining({ body: 'There', tag: 'msg-1' }),
      )
    })

    it('skips foreground notification when suppression checker is active', async () => {
      const { setPushSuppressionChecker } = await import('../pushSuppression')
      setPushSuppressionChecker(() => true)

      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      const registration = mockServiceWorkerRegistration()
      const onForeground = vi.fn()
      fcmMocks.onMessage.mockImplementation((_messaging, cb) => {
        cb({
          notification: { title: 'Hi', body: 'There' },
          data: { chat_id: 'chat-1' },
        })
      })

      await setupPushNotifications({ onForegroundNotification: onForeground })

      expect(registration.showNotification).not.toHaveBeenCalled()
      expect(onForeground).not.toHaveBeenCalled()
      setPushSuppressionChecker(null)
    })

    it('uses service worker.ready when registration has no active worker yet', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      const registration = { active: {} } as ServiceWorkerRegistration
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: vi.fn().mockResolvedValue({ active: null }),
          ready: Promise.resolve(registration),
        },
        configurable: true,
      })

      const result = await setupPushNotifications()
      expect(result.token).toBe('web-fcm-token')
      mockServiceWorkerRegistration()
    })

    it('rejects when service worker.ready fails', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: vi.fn().mockResolvedValue(null),
          ready: Promise.reject(new Error('sw broken')),
        },
        configurable: true,
      })

      await expect(setupPushNotifications()).rejects.toThrow('sw broken')
      mockServiceWorkerRegistration()
    })

    it('rejects when service worker is not ready in time', async () => {
      vi.useFakeTimers()
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: vi.fn().mockResolvedValue(null),
          ready: new Promise(() => {}),
        },
        configurable: true,
      })

      const pending = setupPushNotifications()
      const assertion = expect(pending).rejects.toThrow(/Service worker not ready/)
      await vi.advanceTimersByTimeAsync(15_001)
      await assertion
      vi.useRealTimers()
      mockServiceWorkerRegistration()
    })
  })

  describe('setupPushNotifications (native)', () => {
    beforeEach(() => {
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      capacitorMocks.getPlatform.mockReturnValue('android')
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'granted' })
      localNotificationsMocks.requestPermissions.mockResolvedValue({ display: 'granted' })
      pushNotificationsMocks.addListener.mockImplementation((event: string, cb: (arg: unknown) => void) => {
        if (event === 'registration') {
          queueMicrotask(() => cb({ value: 'native-token' }))
        }
        return Promise.resolve({ remove: vi.fn() })
      })
      pushNotificationsMocks.register.mockImplementation(() => {
        queueMicrotask(() => {
          const registrationCalls = pushNotificationsMocks.addListener.mock.calls.filter(
            (call) => call[0] === 'registration',
          )
          const handler = registrationCalls.at(-1)?.[1] as ((token: { value: string }) => void) | undefined
          handler?.({ value: 'native-token' })
        })
        return Promise.resolve()
      })
    })

    it('returns prompt without requesting when not granted and requestPermission false', async () => {
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'prompt' })
      const result = await setupPushNotifications(undefined, { requestPermission: false })
      expect(result).toMatchObject({ token: null, permission: 'prompt' })
      expect(pushNotificationsMocks.requestPermissions).not.toHaveBeenCalled()
      expect(localNotificationsMocks.requestPermissions).not.toHaveBeenCalled()
    })

    it('requests local notification permission on Android when user opts in', async () => {
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'prompt' })
      localNotificationsMocks.requestPermissions.mockResolvedValue({ display: 'granted' })

      await setupPushNotifications(undefined, { requestPermission: true })

      expect(localNotificationsMocks.requestPermissions).toHaveBeenCalled()
      expect(pushNotificationsMocks.requestPermissions).not.toHaveBeenCalled()
    })

    it('does not request local notification permission during passive native setup', async () => {
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'prompt' })

      await setupPushNotifications(undefined, { requestPermission: false })

      expect(localNotificationsMocks.requestPermissions).not.toHaveBeenCalled()
    })

    it('registers and resolves token when granted', async () => {
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      const onToken = vi.fn()
      const result = await setupPushNotifications({ onToken })
      expect(result).toMatchObject({
        platform: 'android',
        token: 'native-token',
        permission: 'granted',
      })
      expect(onToken).toHaveBeenCalledWith('native-token', 'android')
    })

    it('returns denied without throwing when user refuses permission', async () => {
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'prompt' })
      localNotificationsMocks.requestPermissions.mockResolvedValue({ display: 'denied' })
      const result = await setupPushNotifications(undefined, { requestPermission: true })
      expect(result).toMatchObject({ token: null, permission: 'denied' })
    })

    it('maps non-string values in capacitor notification data', async () => {
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      const onForeground = vi.fn()
      await setupPushNotifications({ onForegroundNotification: onForeground })

      const receivedCalls = pushNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'pushNotificationReceived',
      )
      const handler = receivedCalls[0]![1] as (n: {
        title: string
        body: string
        data: Record<string, unknown>
      }) => void
      handler({
        title: 'T',
        body: 'B',
        data: { num: 42 },
      })
      expect(onForeground).toHaveBeenCalledWith(
        expect.objectContaining({ data: { num: '42' } }),
      )
    })

    it('fires native foreground and action listeners once', async () => {
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      const onForeground = vi.fn()
      await setupPushNotifications({ onForegroundNotification: onForeground })
      await setupPushNotifications({ onForegroundNotification: onForeground })

      const receivedCalls = pushNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'pushNotificationReceived',
      )
      expect(receivedCalls).toHaveLength(1)

      const handler = receivedCalls[0]![1] as (n: {
        title: string
        body: string
        data: Record<string, unknown>
      }) => void
      handler({
        title: 'Native',
        body: 'Alert',
        data: { num: 1 },
      })
      expect(onForeground).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Native', body: 'Alert' }),
      )
    })

    it('shows local notification on native foreground when not suppressed', async () => {
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'granted' })
      await setupPushNotifications()

      const receivedCalls = pushNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'pushNotificationReceived',
      )
      const handler = receivedCalls[0]![1] as (n: {
        title: string
        body: string
        data: Record<string, string>
      }) => void

      handler({
        title: 'Orçamento',
        body: 'Nova mensagem',
        data: { dispatch_id: 'dispatch-1', chat_id: 'other-chat' },
      })

      await vi.waitFor(() => {
        expect(localNotificationsMocks.schedule).toHaveBeenCalledWith(
          expect.objectContaining({
            notifications: [
              expect.objectContaining({
                title: 'Orçamento',
                body: 'Nova mensagem',
                group: 'other-chat',
              }),
            ],
          }),
        )
      })
    })

    it('skips local notification on native foreground when suppressed', async () => {
      const { setPushSuppressionChecker } = await import('../pushSuppression')
      setPushSuppressionChecker(() => true)

      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      await setupPushNotifications()

      const receivedCalls = pushNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'pushNotificationReceived',
      )
      const handler = receivedCalls[0]![1] as (n: {
        title: string
        body: string
        data: Record<string, string>
      }) => void

      handler({
        title: 'Chat',
        body: 'Oi',
        data: { chat_id: 'chat-1' },
      })

      await new Promise((r) => setTimeout(r, 0))
      expect(localNotificationsMocks.schedule).not.toHaveBeenCalled()
      setPushSuppressionChecker(null)
    })

    it('navigates on pushNotificationActionPerformed when deep_link_path is present', async () => {
      const { registerPushNavigationHandler, resetPushNavigationForTests } = await import(
        '../pushNavigation'
      )
      const paths: string[] = []
      const unregister = registerPushNavigationHandler((path) => paths.push(path))

      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      await setupPushNotifications()

      const actionCalls = pushNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'pushNotificationActionPerformed',
      )
      const handler = actionCalls[0]![1] as (action: {
        actionId: string
        notification: { title?: string; body?: string; data?: Record<string, string> }
      }) => void
      handler({
        actionId: 'tap',
        notification: {
          title: 'Nova mensagem',
          body: 'Oi',
          data: {
            chat_id: 'chat-1',
            dispatch_id: 'dispatch-1',
            deep_link_path: '/dashboard/chats/chat-1',
          },
        },
      })

      expect(paths).toEqual(['/dashboard/chats/chat-1'])

      unregister()
      resetPushNavigationForTests()
    })

    it('rejects on registration error', async () => {
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      pushNotificationsMocks.addListener.mockImplementation(() => Promise.resolve({ remove: vi.fn() }))
      pushNotificationsMocks.register.mockImplementation(() => {
        queueMicrotask(() => {
          queueMicrotask(() => {
            const errorCalls = pushNotificationsMocks.addListener.mock.calls.filter(
              (call) => call[0] === 'registrationError',
            )
            const handler = errorCalls.at(-1)?.[1] as ((error: Error) => void) | undefined
            handler?.(new Error('reg fail'))
          })
        })
        return Promise.resolve()
      })
      await expect(setupPushNotifications()).rejects.toThrow('reg fail')
    })

    it('times out when native FCM registration never resolves', async () => {
      vi.useFakeTimers()
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      pushNotificationsMocks.addListener.mockImplementation(() => Promise.resolve({ remove: vi.fn() }))
      pushNotificationsMocks.register.mockResolvedValue(undefined)

      const pending = setupPushNotifications()
      const assertion = expect(pending).rejects.toThrow(/Não foi possível concluir o registro/)
      await vi.advanceTimersByTimeAsync(20_001)
      await assertion
      vi.useRealTimers()
    })

    it('warns on iOS when local notification permission stays denied after prompt', async () => {
      const { logger } = await import('../logger')
      capacitorMocks.getPlatform.mockReturnValue('ios')
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'denied' })
      localNotificationsMocks.requestPermissions.mockResolvedValue({ display: 'denied' })

      await setupPushNotifications(undefined, { requestPermission: true })

      expect(logger.warn).toHaveBeenCalledWith(
        '[PUSH] local notification permission not granted after user prompt',
      )
    })

    it('handles local notification action taps with engagement tracking', async () => {
      const { registerPushNavigationHandler, resetPushNavigationForTests } = await import(
        '../pushNavigation'
      )
      const paths: string[] = []
      const unregister = registerPushNavigationHandler((path) => paths.push(path))

      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      await setupPushNotifications()

      const localActionCalls = localNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'localNotificationActionPerformed',
      )
      const handler = localActionCalls[0]![1] as (action: {
        actionId: string
        notification: {
          title?: string
          body?: string
          extra?: Record<string, unknown>
        }
      }) => void

      handler({
        actionId: 'tap',
        notification: {
          title: 'Local',
          body: 'Body',
          extra: {
            dispatch_id: 'dispatch-9',
            deep_link_path: '/dashboard/chats/chat-9',
            count: 2,
            skip: null,
          },
        },
      })

      expect(paths).toEqual(['/dashboard/chats/chat-9'])
      unregister()
      resetPushNavigationForTests()
    })

    it('reuses an in-flight setup promise for concurrent callers', async () => {
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      const first = setupPushNotifications()
      const second = setupPushNotifications()
      const [a, b] = await Promise.all([first, second])
      expect(a.token).toBe('native-token')
      expect(b.token).toBe('native-token')
    })
  })

  describe('getPushRegistrationState', () => {
    it('delegates to setupPushNotifications', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      const state = await getPushRegistrationState()
      expect(state.pushEnabled).toBe(true)
      expect(state.fcmToken).toBe('web-fcm-token')
    })

    it('returns cached state without re-running setup', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })

      await getPushRegistrationState()
      const tokenCallsAfterFirst = fcmMocks.getToken.mock.calls.length

      const cached = await getPushRegistrationState()
      expect(cached.fcmToken).toBe('web-fcm-token')
      expect(fcmMocks.getToken.mock.calls.length).toBe(tokenCallsAfterFirst)
    })

    it('falls back to unsupported when setup leaves no cached state', async () => {
      firebaseConfigMocks.isFirebaseConfigured.mockReturnValue(false)
      const state = await getPushRegistrationState()
      expect(state).toEqual({
        platform: 'web',
        pushEnabled: false,
        fcmToken: null,
        permission: 'unsupported',
      })
    })
  })

  describe('remaining push edge branches', () => {
    it('defaults permission to default when result omits it', () => {
      expect(
        toPushRegistrationState({
          platform: 'web',
          token: null,
          permission: undefined as unknown as 'denied',
        }),
      ).toMatchObject({ permission: 'default', pushEnabled: false, fcmToken: null })
    })

    it('returns unsupported when Notification is missing but firebase is configured', async () => {
      // @ts-expect-error testing missing API
      delete globalThis.Notification
      firebaseConfigMocks.isFirebaseConfigured.mockReturnValue(true)
      await expect(getPushPermissionStatus()).resolves.toBe('unsupported')
    })

    it('uses default title and empty body for whitespace-only foreground content', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      const registration = mockServiceWorkerRegistration()
      await showWebForegroundSystemNotification({ title: '   ', body: undefined })
      expect(registration.showNotification).toHaveBeenCalledWith(
        'Renovi',
        expect.objectContaining({ body: '' }),
      )
    })

    it('skips web foreground notification when serviceWorker is missing', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      vi.stubGlobal('navigator', { userAgent: 'test' })
      await expect(
        showWebForegroundSystemNotification({ title: 'T', body: 'B' }),
      ).resolves.toBeUndefined()
    })

    it('logs engagement tracking failures for native action taps', async () => {
      recordPushClickMock.mockRejectedValueOnce(new Error('track fail'))
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      capacitorMocks.getPlatform.mockReturnValue('android')
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'granted' })
      pushNotificationsMocks.addListener.mockImplementation((event, cb) => {
        if (event === 'registration') {
          queueMicrotask(() => (cb as (token: { value: string }) => void)({ value: 'native-token' }))
        }
        return Promise.resolve({ remove: vi.fn() })
      })
      pushNotificationsMocks.register.mockImplementation(() => {
        queueMicrotask(() => {
          const registrationCalls = pushNotificationsMocks.addListener.mock.calls.filter(
            (call) => call[0] === 'registration',
          )
          const handler = registrationCalls.at(-1)?.[1] as
            | ((token: { value: string }) => void)
            | undefined
          handler?.({ value: 'native-token' })
        })
        return Promise.resolve()
      })

      const { logger } = await import('../logger')
      await setupPushNotifications()
      const actionCalls = pushNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'pushNotificationActionPerformed',
      )
      const action = actionCalls[0]![1] as (a: {
        actionId: string
        notification: { title?: string; body?: string; data?: Record<string, string> }
      }) => void
      action({
        actionId: 'tap',
        notification: {
          title: 'T',
          body: 'B',
          data: { dispatch_id: 'd-fail', deep_link_path: '/dashboard' },
        },
      })

      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith(
          '[PUSH] engagement tracking failed',
          expect.objectContaining({ dispatchId: 'd-fail' }),
        )
      })
    })

    it('logs non-Error engagement tracking failures', async () => {
      recordPushClickMock.mockRejectedValueOnce('track-down')
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      capacitorMocks.getPlatform.mockReturnValue('android')
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'granted' })
      pushNotificationsMocks.addListener.mockImplementation((event, cb) => {
        if (event === 'registration') {
          queueMicrotask(() => (cb as (token: { value: string }) => void)({ value: 'native-token' }))
        }
        return Promise.resolve({ remove: vi.fn() })
      })
      pushNotificationsMocks.register.mockImplementation(() => {
        queueMicrotask(() => {
          const registrationCalls = pushNotificationsMocks.addListener.mock.calls.filter(
            (call) => call[0] === 'registration',
          )
          const handler = registrationCalls.at(-1)?.[1] as
            | ((token: { value: string }) => void)
            | undefined
          handler?.({ value: 'native-token' })
        })
        return Promise.resolve()
      })

      const { logger } = await import('../logger')
      await setupPushNotifications()
      const actionCalls = pushNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'pushNotificationActionPerformed',
      )
      const action = actionCalls[0]![1] as (a: {
        actionId: string
        notification: { data?: Record<string, string> }
      }) => void
      action({
        actionId: 'tap',
        notification: { data: { dispatch_id: 'd-2' } },
      })

      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith(
          '[PUSH] engagement tracking failed',
          expect.objectContaining({ error: 'track-down' }),
        )
      })
    })

    it('logs non-Error failures when showing web foreground notifications', async () => {
      const { logger } = await import('../logger')
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: vi.fn(),
          ready: Promise.reject('sw-down'),
        },
        configurable: true,
      })
      await showWebForegroundSystemNotification({ title: 'T', body: 'B' })
      expect(logger.warn).toHaveBeenCalledWith(
        '[PUSH] foreground system notification failed (web)',
        expect.objectContaining({ message: 'sw-down' }),
      )
    })

    it('maps firebase messages without data and with non-string data values', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })
      fcmMocks.onMessage.mockImplementation((_messaging, cb) => {
        cb({
          notification: { title: 'N', body: 'B' },
        })
        cb({
          data: { count: 3 as unknown as string },
        })
      })
      const onForeground = vi.fn()
      await setupPushNotifications({ onForegroundNotification: onForeground })
      expect(onForeground).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'N', body: 'B', data: undefined }),
      )
      expect(onForeground).toHaveBeenCalledWith(
        expect.objectContaining({ data: { count: '3' } }),
      )
    })

    it('normalizes native registrationError string and plain object shapes', async () => {
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      capacitorMocks.getPlatform.mockReturnValue('android')
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'granted' })
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      pushNotificationsMocks.addListener.mockImplementation(() =>
        Promise.resolve({ remove: vi.fn() }),
      )
      pushNotificationsMocks.register.mockImplementation(() => {
        queueMicrotask(() => {
          queueMicrotask(() => {
            const errorCalls = pushNotificationsMocks.addListener.mock.calls.filter(
              (call) => call[0] === 'registrationError',
            )
            const handler = errorCalls.at(-1)?.[1] as ((error: unknown) => void) | undefined
            handler?.('string-fail')
          })
        })
        return Promise.resolve()
      })
      await expect(setupPushNotifications()).rejects.toThrow('string-fail')

      resetPushModuleStateForTests()
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      capacitorMocks.getPlatform.mockReturnValue('android')
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'granted' })
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      pushNotificationsMocks.addListener.mockImplementation(() =>
        Promise.resolve({ remove: vi.fn() }),
      )
      pushNotificationsMocks.register.mockImplementation(() => {
        queueMicrotask(() => {
          queueMicrotask(() => {
            const errorCalls = pushNotificationsMocks.addListener.mock.calls.filter(
              (call) => call[0] === 'registrationError',
            )
            const handler = errorCalls.at(-1)?.[1] as ((error: unknown) => void) | undefined
            handler?.({ code: 'ERR' })
          })
        })
        return Promise.resolve()
      })
      await expect(setupPushNotifications()).rejects.toThrow('FCM registration failed')
    })

    it('handles native action without dispatch_id and notification without data', async () => {
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      capacitorMocks.getPlatform.mockReturnValue('android')
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'granted' })
      pushNotificationsMocks.addListener.mockImplementation((event, cb) => {
        if (event === 'registration') {
          queueMicrotask(() => (cb as (token: { value: string }) => void)({ value: 'native-token' }))
        }
        return Promise.resolve({ remove: vi.fn() })
      })
      pushNotificationsMocks.register.mockImplementation(() => {
        queueMicrotask(() => {
          const registrationCalls = pushNotificationsMocks.addListener.mock.calls.filter(
            (call) => call[0] === 'registration',
          )
          const handler = registrationCalls.at(-1)?.[1] as
            | ((token: { value: string }) => void)
            | undefined
          handler?.({ value: 'native-token' })
        })
        return Promise.resolve()
      })
      const onForeground = vi.fn()
      await setupPushNotifications({ onForegroundNotification: onForeground })

      const receivedCalls = pushNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'pushNotificationReceived',
      )
      const received = receivedCalls[0]![1] as (n: {
        title?: string
        body?: string
        data?: Record<string, unknown>
      }) => void
      received({ title: 'T', body: 'B' })
      expect(onForeground).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'T', body: 'B', data: undefined }),
      )

      const actionCalls = pushNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'pushNotificationActionPerformed',
      )
      const action = actionCalls[0]![1] as (a: {
        actionId: string
        notification: { title?: string; body?: string; data?: Record<string, string> }
      }) => void
      action({
        actionId: 'tap',
        notification: { title: 'T', body: 'B', data: { chat_id: 'c1' } },
      })
    })

    it('handles local notification actions without extra or dispatch_id', async () => {
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      capacitorMocks.getPlatform.mockReturnValue('android')
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'granted' })
      pushNotificationsMocks.addListener.mockImplementation((event, cb) => {
        if (event === 'registration') {
          queueMicrotask(() => (cb as (token: { value: string }) => void)({ value: 'native-token' }))
        }
        return Promise.resolve({ remove: vi.fn() })
      })
      pushNotificationsMocks.register.mockImplementation(() => {
        queueMicrotask(() => {
          const registrationCalls = pushNotificationsMocks.addListener.mock.calls.filter(
            (call) => call[0] === 'registration',
          )
          const handler = registrationCalls.at(-1)?.[1] as
            | ((token: { value: string }) => void)
            | undefined
          handler?.({ value: 'native-token' })
        })
        return Promise.resolve()
      })
      await setupPushNotifications()

      const localActionCalls = localNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'localNotificationActionPerformed',
      )
      const handler = localActionCalls[0]![1] as (action: {
        actionId: string
        notification: {
          title?: string
          body?: string
          extra?: unknown
        }
      }) => void

      handler({
        actionId: 'tap',
        notification: { title: undefined, body: undefined, extra: 'not-object' },
      })
      handler({
        actionId: 'tap',
        notification: {
          title: 'Local',
          body: 'Body',
          extra: { chat_id: 'c1', skip: null },
        },
      })
    })

    it('reuses a cached native FCM token on a subsequent setup', async () => {
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      capacitorMocks.getPlatform.mockReturnValue('android')
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'granted' })
      pushNotificationsMocks.addListener.mockImplementation((event, cb) => {
        if (event === 'registration') {
          queueMicrotask(() => (cb as (token: { value: string }) => void)({ value: 'native-token' }))
        }
        return Promise.resolve({ remove: vi.fn() })
      })
      pushNotificationsMocks.register.mockImplementation(() => {
        queueMicrotask(() => {
          const registrationCalls = pushNotificationsMocks.addListener.mock.calls.filter(
            (call) => call[0] === 'registration',
          )
          const handler = registrationCalls.at(-1)?.[1] as
            | ((token: { value: string }) => void)
            | undefined
          handler?.({ value: 'native-token' })
        })
        return Promise.resolve()
      })

      const first = await setupPushNotifications()
      expect(first.token).toBe('native-token')
      pushNotificationsMocks.register.mockClear()
      const second = await setupPushNotifications()
      expect(second.token).toBe('native-token')
      expect(pushNotificationsMocks.register).not.toHaveBeenCalled()
    })

    it('does not warn on iOS when local permission is denied without requesting', async () => {
      const { logger } = await import('../logger')
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      capacitorMocks.getPlatform.mockReturnValue('ios')
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'denied' })
      pushNotificationsMocks.addListener.mockImplementation((event, cb) => {
        if (event === 'registration') {
          queueMicrotask(() => (cb as (token: { value: string }) => void)({ value: 'ios-token' }))
        }
        return Promise.resolve({ remove: vi.fn() })
      })
      pushNotificationsMocks.register.mockImplementation(() => {
        queueMicrotask(() => {
          const registrationCalls = pushNotificationsMocks.addListener.mock.calls.filter(
            (call) => call[0] === 'registration',
          )
          const handler = registrationCalls.at(-1)?.[1] as
            | ((token: { value: string }) => void)
            | undefined
          handler?.({ value: 'ios-token' })
        })
        return Promise.resolve()
      })

      await setupPushNotifications(undefined, { requestPermission: false })
      expect(logger.warn).not.toHaveBeenCalledWith(
        '[PUSH] local notification permission not granted after user prompt',
      )
    })

    it('logs non-Error failures from native foreground local notifications', async () => {
      const { logger } = await import('../logger')
      const { setPushSuppressionChecker } = await import('../pushSuppression')
      setPushSuppressionChecker(() => false)
      capacitorMocks.isNativePlatform.mockReturnValue(true)
      capacitorMocks.getPlatform.mockReturnValue('android')
      pushNotificationsMocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
      localNotificationsMocks.checkPermissions.mockResolvedValue({ display: 'granted' })
      localNotificationsMocks.schedule.mockRejectedValueOnce('schedule-down')
      pushNotificationsMocks.addListener.mockImplementation((event, cb) => {
        if (event === 'registration') {
          queueMicrotask(() => (cb as (token: { value: string }) => void)({ value: 'native-token' }))
        }
        return Promise.resolve({ remove: vi.fn() })
      })
      pushNotificationsMocks.register.mockImplementation(() => {
        queueMicrotask(() => {
          const registrationCalls = pushNotificationsMocks.addListener.mock.calls.filter(
            (call) => call[0] === 'registration',
          )
          const handler = registrationCalls.at(-1)?.[1] as
            | ((token: { value: string }) => void)
            | undefined
          handler?.({ value: 'native-token' })
        })
        return Promise.resolve()
      })

      await setupPushNotifications()
      const receivedCalls = pushNotificationsMocks.addListener.mock.calls.filter(
        (c) => c[0] === 'pushNotificationReceived',
      )
      const handler = receivedCalls[0]![1] as (n: {
        title: string
        body: string
        data: Record<string, string>
      }) => void
      handler({ title: 'T', body: 'B', data: { chat_id: 'other' } })

      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith(
          '[PUSH] foreground local notification failed (native)',
          expect.objectContaining({ message: 'schedule-down' }),
        )
      })
      setPushSuppressionChecker(null)
    })
  })
})
