import { describe, expect, it } from 'vitest'
import type { PushNotificationPayload } from '../push'
import {
  handlePushNotificationOpen,
  normalizeDeepLinkPath,
  registerPushNavigationHandler,
  resetPushNavigationForTests,
  resolvePushNotificationPath,
} from '../pushNavigation'

describe('normalizeDeepLinkPath', () => {
  it('accepts relative in-app paths', () => {
    expect(normalizeDeepLinkPath('/dashboard/chats/chat-xyz')).toBe(
      '/dashboard/chats/chat-xyz',
    )
    expect(normalizeDeepLinkPath('/pedir-orcamento')).toBe('/pedir-orcamento')
    expect(normalizeDeepLinkPath('/login')).toBe('/login')
  })

  it('rejects external or unsafe paths', () => {
    expect(normalizeDeepLinkPath('//evil.com')).toBeNull()
    expect(normalizeDeepLinkPath('https://evil.com')).toBeNull()
    expect(normalizeDeepLinkPath('login')).toBeNull()
  })
})

describe('resolvePushNotificationPath', () => {
  it('uses deep_link_path from payload', () => {
    const payload: PushNotificationPayload = {
      data: { deep_link_path: '/dashboard/chats/chat-xyz' },
    }
    expect(resolvePushNotificationPath(payload)).toBe('/dashboard/chats/chat-xyz')
  })

  it('ignores chat_id without deep_link_path', () => {
    expect(resolvePushNotificationPath({ data: { chat_id: 'chat-abc' } })).toBeNull()
  })

  it('returns null when deep_link_path is missing or invalid', () => {
    expect(resolvePushNotificationPath({ data: { dispatch_id: 'd-1' } })).toBeNull()
    expect(resolvePushNotificationPath({})).toBeNull()
    expect(
      resolvePushNotificationPath({ data: { deep_link_path: 'https://evil.com' } }),
    ).toBeNull()
  })
})

describe('handlePushNotificationOpen', () => {
  it('queues navigation until a handler is registered', () => {
    resetPushNavigationForTests()
    const paths: string[] = []

    expect(
      handlePushNotificationOpen({
        data: { deep_link_path: '/dashboard/chats/pending-chat' },
      }),
    ).toBe('/dashboard/chats/pending-chat')

    const unregister = registerPushNavigationHandler((path) => paths.push(path))
    expect(paths).toEqual(['/dashboard/chats/pending-chat'])

    unregister()
    resetPushNavigationForTests()
  })
})
