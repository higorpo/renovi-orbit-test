import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getFirebaseClientConfig,
  getFirebaseVapidKey,
  isFirebaseConfigured,
} from '../config'

describe('firebase config', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'api-key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'auth.example.com')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'project')
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123')
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'app-id')
    vi.stubEnv('VITE_FIREBASE_VAPID_KEY', '  vapid-key  ')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('getFirebaseClientConfig returns config when all vars are set', () => {
    expect(getFirebaseClientConfig()).toEqual({
      apiKey: 'api-key',
      authDomain: 'auth.example.com',
      projectId: 'project',
      messagingSenderId: '123',
      appId: 'app-id',
    })
  })

  it('getFirebaseClientConfig returns null when a required var is missing', () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')
    expect(getFirebaseClientConfig()).toBeNull()
  })

  it('getFirebaseVapidKey trims whitespace', () => {
    expect(getFirebaseVapidKey()).toBe('vapid-key')
  })

  it('getFirebaseVapidKey returns null when empty', () => {
    vi.stubEnv('VITE_FIREBASE_VAPID_KEY', '   ')
    expect(getFirebaseVapidKey()).toBeNull()
  })

  it('isFirebaseConfigured requires config and vapid key', () => {
    expect(isFirebaseConfigured()).toBe(true)
    vi.stubEnv('VITE_FIREBASE_VAPID_KEY', '')
    expect(isFirebaseConfigured()).toBe(false)
  })
})
