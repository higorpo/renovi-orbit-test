import { beforeEach, describe, expect, it, vi } from 'vitest'

const firebaseMessagingMocks = vi.hoisted(() => ({
  getMessaging: vi.fn(() => ({ messaging: true })),
}))

vi.mock('firebase/messaging', () => ({
  getMessaging: firebaseMessagingMocks.getMessaging,
}))

import { getFirebaseMessaging, resetFirebaseMessagingForTests } from '../messaging'

describe('getFirebaseMessaging', () => {
  const app = { name: 'test-app' } as import('firebase/app').FirebaseApp

  beforeEach(() => {
    vi.clearAllMocks()
    resetFirebaseMessagingForTests()
  })

  it('creates messaging instance for app', () => {
    const messaging = getFirebaseMessaging(app)
    expect(firebaseMessagingMocks.getMessaging).toHaveBeenCalledWith(app)
    expect(messaging).toEqual({ messaging: true })
  })

  it('returns cached messaging instance', () => {
    const first = getFirebaseMessaging(app)
    firebaseMessagingMocks.getMessaging.mockClear()
    const second = getFirebaseMessaging(app)
    expect(second).toBe(first)
    expect(firebaseMessagingMocks.getMessaging).not.toHaveBeenCalled()
  })
})
