import { beforeEach, describe, expect, it, vi } from 'vitest'

const firebaseAppMocks = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: 'new-app' })),
  getApps: vi.fn((): { name: string }[] => []),
}))

vi.mock('firebase/app', () => ({
  initializeApp: firebaseAppMocks.initializeApp,
  getApps: () => firebaseAppMocks.getApps(),
}))

vi.mock('../config', () => ({
  getFirebaseClientConfig: vi.fn(),
}))

import { getFirebaseClientConfig } from '../config'
import { getFirebaseApp, resetFirebaseAppForTests } from '../app'

describe('getFirebaseApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetFirebaseAppForTests()
  })

  it('returns null when firebase config is missing', () => {
    vi.mocked(getFirebaseClientConfig).mockReturnValue(null)
    expect(getFirebaseApp()).toBeNull()
    expect(firebaseAppMocks.initializeApp).not.toHaveBeenCalled()
  })

  it('initializes app when config exists and no apps yet', () => {
    vi.mocked(getFirebaseClientConfig).mockReturnValue({
      apiKey: 'k',
      authDomain: 'd',
      projectId: 'p',
      messagingSenderId: 's',
      appId: 'a',
    })
    firebaseAppMocks.getApps.mockReturnValue([])

    const app = getFirebaseApp()

    expect(firebaseAppMocks.initializeApp).toHaveBeenCalledWith({
      apiKey: 'k',
      authDomain: 'd',
      projectId: 'p',
      messagingSenderId: 's',
      appId: 'a',
    })
    expect(app).toEqual({ name: 'new-app' })
  })

  it('reuses existing firebase app when getApps has entries', () => {
    vi.mocked(getFirebaseClientConfig).mockReturnValue({
      apiKey: 'k',
      authDomain: 'd',
      projectId: 'p',
      messagingSenderId: 's',
      appId: 'a',
    })
    firebaseAppMocks.getApps.mockReturnValue([{ name: 'existing' }])

    const app = getFirebaseApp()

    expect(firebaseAppMocks.initializeApp).not.toHaveBeenCalled()
    expect(app).toEqual({ name: 'existing' })
  })

  it('returns cached instance on subsequent calls', () => {
    vi.mocked(getFirebaseClientConfig).mockReturnValue({
      apiKey: 'k',
      authDomain: 'd',
      projectId: 'p',
      messagingSenderId: 's',
      appId: 'a',
    })
    firebaseAppMocks.getApps.mockReturnValue([])

    const first = getFirebaseApp()
    firebaseAppMocks.initializeApp.mockClear()
    const second = getFirebaseApp()

    expect(second).toBe(first)
    expect(firebaseAppMocks.initializeApp).not.toHaveBeenCalled()
  })
})
