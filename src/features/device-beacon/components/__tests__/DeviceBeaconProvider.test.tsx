import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  profile: { role: 'client' as 'client' | 'provider' | 'admin' },
  loadingSession: false,
}))

const upsertMock = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))
const setupPushMock = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)))
const subscribePushMock = vi.hoisted(() =>
  vi.fn((listener: (state: { pushEnabled: boolean; fcmToken: string | null }) => void) => {
    listener({ pushEnabled: true, fcmToken: 'from-listener' })
    return vi.fn()
  }),
)
const collectPayloadMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth', () => ({
  useAuth: () => authMocks,
}))

vi.mock('../../api/deviceBeacon.api', () => ({
  upsertDeviceBeacon: upsertMock,
}))

const defaultPayload = {
  profile_id: 'user-1',
  device_id: 'device-1',
  fcm_token: null,
  push_enabled: false,
  platform: 'web',
  operating_system: null,
  os_version: null,
  manufacturer: null,
  model: null,
  web_view_version: null,
  device_name: null,
  is_virtual: false,
  android_sdk_version: null,
  ios_version: null,
}

collectPayloadMock.mockResolvedValue(defaultPayload)

vi.mock('../../utils/collectDeviceBeaconPayload', () => ({
  collectDeviceBeaconPayload: collectPayloadMock,
}))

vi.mock('../../utils/locationSync', () => ({
  getLatestProviderLocationSample: vi.fn(() => null),
}))

vi.mock('../../hooks/useProviderLocationTracking', () => ({
  useProviderLocationTracking: vi.fn(),
}))

vi.mock('../ProviderLocationProvider', () => ({
  ProviderLocationProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/push', () => ({
  setupPushNotifications: setupPushMock,
  subscribePushRegistrationState: subscribePushMock,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import '@/lib/capacitor/__tests__/preferencesStorage.harness'
import { clearPreferencesTestStore, getPreferencesTestStore } from '@/lib/capacitor/__tests__/preferencesStorage.harness'
import { saveDeviceBeaconSyncSnapshot } from '../../utils/syncSchedule'
import { DeviceBeaconProvider } from '../DeviceBeaconProvider'

describe('DeviceBeaconProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.user = { id: 'user-1' }
    authMocks.profile = { role: 'client' }
    authMocks.loadingSession = false
    clearPreferencesTestStore()
    collectPayloadMock.mockResolvedValue(defaultPayload)
    upsertMock.mockResolvedValue({ error: null })
    subscribePushMock.mockImplementation((listener) => {
      listener({ pushEnabled: true, fcmToken: 'from-listener' })
      return vi.fn()
    })
    setupPushMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    document.removeEventListener('visibilitychange', () => {})
  })

  it('syncs beacon on mount when user is logged in', async () => {
    render(
      <DeviceBeaconProvider>
        <span>child</span>
      </DeviceBeaconProvider>,
    )

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalled()
    })
    expect(setupPushMock).toHaveBeenCalledTimes(1)
    expect(subscribePushMock).toHaveBeenCalled()
  })

  it('does not sync when session is loading', async () => {
    authMocks.loadingSession = true
    render(
      <DeviceBeaconProvider>
        <span>child</span>
      </DeviceBeaconProvider>,
    )

    await waitFor(() => {
      expect(setupPushMock).not.toHaveBeenCalled()
    })
  })

  it('does not sync when user is absent', async () => {
    authMocks.user = null
    render(
      <DeviceBeaconProvider>
        <span>child</span>
      </DeviceBeaconProvider>,
    )

    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('logs when push state subscription upsert fails', async () => {
    upsertMock.mockResolvedValue({ error: 'push-sync-fail' })

    render(
      <DeviceBeaconProvider>
        <span>child</span>
      </DeviceBeaconProvider>,
    )

    await waitFor(() => expect(upsertMock).toHaveBeenCalled())
    expect(getPreferencesTestStore()['orbit_device_beacon_last_sync_v1']).toBeUndefined()
  })

  it('skips upsert when API returns error', async () => {
    subscribePushMock.mockImplementation(() => vi.fn())
    upsertMock.mockResolvedValue({ error: 'fail' })

    render(
      <DeviceBeaconProvider>
        <span>child</span>
      </DeviceBeaconProvider>,
    )

    await waitFor(() => expect(upsertMock).toHaveBeenCalled())
    expect(getPreferencesTestStore()['orbit_device_beacon_last_sync_v1']).toBeUndefined()
  })

  it('does not force duplicate sync when push state listener fires on subscribe', async () => {
    subscribePushMock.mockImplementation((listener) => {
      listener({ pushEnabled: true, fcmToken: 'from-listener' })
      return vi.fn()
    })

    render(
      <DeviceBeaconProvider>
        <span>child</span>
      </DeviceBeaconProvider>,
    )

    await waitFor(() => expect(upsertMock).toHaveBeenCalled())
    await saveDeviceBeaconSyncSnapshot({
      ...defaultPayload,
      fcm_token: 'from-listener',
      push_enabled: true,
    })

    const callsAfterInitialSync = upsertMock.mock.calls.length
    subscribePushMock.mock.calls[0]?.[0]?.({ pushEnabled: true, fcmToken: 'from-listener' })

    await waitFor(() => expect(upsertMock.mock.calls.length).toBe(callsAfterInitialSync))
  })

  it('logs sync failure without throwing', async () => {
    collectPayloadMock.mockRejectedValueOnce(new Error('collect failed'))

    render(
      <DeviceBeaconProvider>
        <span>child</span>
      </DeviceBeaconProvider>,
    )

    await waitFor(() => expect(collectPayloadMock).toHaveBeenCalled())
  })

  it('logs non-Error sync failure', async () => {
    collectPayloadMock.mockRejectedValueOnce('collect failed')

    render(
      <DeviceBeaconProvider>
        <span>child</span>
      </DeviceBeaconProvider>,
    )

    await waitFor(() => expect(collectPayloadMock).toHaveBeenCalled())
  })

  it('skips sync when shouldSyncDeviceBeacon returns false', async () => {
    subscribePushMock.mockImplementation(() => vi.fn())
    await saveDeviceBeaconSyncSnapshot(defaultPayload)

    render(
      <DeviceBeaconProvider>
        <span>child</span>
      </DeviceBeaconProvider>,
    )

    await waitFor(() => expect(collectPayloadMock).toHaveBeenCalled())
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('re-runs sync when tab becomes visible after sync interval', async () => {
    const { DEVICE_BEACON_SYNC_INTERVAL_MS, DEVICE_BEACON_SYNC_STORAGE_KEY } = await import(
      '../../types/deviceBeacon.types'
    )

    render(
      <DeviceBeaconProvider>
        <span>child</span>
      </DeviceBeaconProvider>,
    )

    await waitFor(() => expect(upsertMock).toHaveBeenCalled())

    const snapshots = JSON.parse(
      getPreferencesTestStore()[DEVICE_BEACON_SYNC_STORAGE_KEY] ?? '[]',
    ) as {
      profileId: string
      deviceId: string
      lastSyncedAt: string
    }[]
    if (snapshots[0]) {
      snapshots[0].lastSyncedAt = new Date(
        Date.now() - DEVICE_BEACON_SYNC_INTERVAL_MS - 1000,
      ).toISOString()
      getPreferencesTestStore()[DEVICE_BEACON_SYNC_STORAGE_KEY] =
        JSON.stringify(snapshots)
    }

    const callsBefore = upsertMock.mock.calls.length
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(upsertMock.mock.calls.length).toBeGreaterThan(callsBefore))
  })
})
