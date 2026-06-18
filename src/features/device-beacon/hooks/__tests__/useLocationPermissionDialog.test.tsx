// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  profile: { role: 'provider' as 'provider' | 'client' },
  loadingSession: false,
}))

const locationMocks = vi.hoisted(() => ({
  getOperationalLocationPermissionStatus: vi.fn(),
  requestOperationalLocationPermission: vi.fn(),
}))

const storageMocks = vi.hoisted(() => ({
  isLocationPromptSeen: vi.fn(async () => false),
  markLocationPromptSeen: vi.fn(),
  getStoredLocationPermissionGranted: vi.fn(async () => null as boolean | null),
  setStoredLocationPermissionGranted: vi.fn(),
}))

const trackEventMock = vi.fn()

vi.mock('@/features/auth', () => ({
  useAuth: () => authMocks,
}))

vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackEvent: trackEventMock }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn() },
}))

vi.mock('../../utils/locationPermissionPrompt.storage', () => storageMocks)

vi.mock('../../utils/requestOperationalLocationPermission', () => ({
  getOperationalLocationPermissionStatus: locationMocks.getOperationalLocationPermissionStatus,
  requestOperationalLocationPermission: locationMocks.requestOperationalLocationPermission,
  captureOperationalLocationFix: vi.fn(async () => null),
}))

const trackingMocks = vi.hoisted(() => ({
  startProviderLocationTracking: vi.fn(),
  scheduleLocationBeaconSync: vi.fn(),
  syncProviderBeaconNow: vi.fn(),
  flushLocationBeaconSyncNow: vi.fn(),
}))

vi.mock('../../utils/providerLocationTracking.runtime', () => ({
  startProviderLocationTracking: trackingMocks.startProviderLocationTracking,
}))

vi.mock('../../utils/locationSync', () => ({
  scheduleLocationBeaconSync: trackingMocks.scheduleLocationBeaconSync,
  syncProviderBeaconNow: trackingMocks.syncProviderBeaconNow,
  flushLocationBeaconSyncNow: trackingMocks.flushLocationBeaconSyncNow,
}))

import { useLocationPermissionDialog } from '../useLocationPermissionDialog'

describe('useLocationPermissionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.user = { id: 'user-1' }
    authMocks.profile = { role: 'provider' }
    authMocks.loadingSession = false
    locationMocks.getOperationalLocationPermissionStatus.mockResolvedValue('prompt')
    locationMocks.requestOperationalLocationPermission.mockResolvedValue({
      granted: true,
      status: 'granted',
      latitude: -27.5,
      longitude: -48.5,
      accuracyMeters: 10,
    })
    storageMocks.isLocationPromptSeen.mockResolvedValue(false)
    storageMocks.getStoredLocationPermissionGranted.mockResolvedValue(null)
  })

  it('does not open for clients', async () => {
    authMocks.profile = { role: 'client' }
    const { result } = renderHook(() => useLocationPermissionDialog())

    await waitFor(() => expect(locationMocks.getOperationalLocationPermissionStatus).not.toHaveBeenCalled())
    expect(result.current.open).toBe(false)
  })

  it('opens for providers pending permission', async () => {
    const { result } = renderHook(() => useLocationPermissionDialog())

    await waitFor(() => expect(result.current.open).toBe(true))
  })

  it('does not open when prompt was already seen', async () => {
    storageMocks.isLocationPromptSeen.mockResolvedValue(true)
    const { result } = renderHook(() => useLocationPermissionDialog())

    await waitFor(() => expect(locationMocks.getOperationalLocationPermissionStatus).toHaveBeenCalled())
    expect(result.current.open).toBe(false)
  })

  it('dismiss persists denied state without OS prompt', async () => {
    const { result } = renderHook(() => useLocationPermissionDialog())
    await waitFor(() => expect(result.current.open).toBe(true))

    await act(async () => {
      await result.current.dismiss()
    })

    expect(storageMocks.markLocationPromptSeen).toHaveBeenCalled()
    expect(storageMocks.setStoredLocationPermissionGranted).toHaveBeenCalledWith(false)
    expect(trackEventMock).toHaveBeenCalledWith('location_permission_denied', {
      user_role: 'provider',
      source: 'explainer_decline',
    })
    expect(locationMocks.requestOperationalLocationPermission).not.toHaveBeenCalled()
    expect(result.current.open).toBe(false)
  })

  it('accept requests OS permission and tracks grant', async () => {
    const { result } = renderHook(() => useLocationPermissionDialog())
    await waitFor(() => expect(result.current.open).toBe(true), { timeout: 2000 })

    await act(async () => {
      await result.current.acceptAndRequestPermission()
    })

    expect(locationMocks.requestOperationalLocationPermission).toHaveBeenCalled()
    expect(storageMocks.setStoredLocationPermissionGranted).toHaveBeenCalledWith(true)
    expect(trackingMocks.scheduleLocationBeaconSync).toHaveBeenCalled()
    expect(trackingMocks.flushLocationBeaconSyncNow).toHaveBeenCalled()
    expect(trackingMocks.startProviderLocationTracking).toHaveBeenCalledWith('user-1')
    expect(trackEventMock).toHaveBeenCalledWith('location_permission_granted', {
      user_role: 'provider',
      source: 'explainer_confirm',
    })
  })

  it('does not persist denied when OS prompt is still pending', async () => {
    locationMocks.requestOperationalLocationPermission.mockResolvedValue({
      granted: false,
      status: 'prompt',
    })
    const { result } = renderHook(() => useLocationPermissionDialog())
    await waitFor(() => expect(result.current.open).toBe(true), { timeout: 2000 })

    await act(async () => {
      await result.current.acceptAndRequestPermission()
    })

    expect(storageMocks.setStoredLocationPermissionGranted).not.toHaveBeenCalled()
    expect(trackingMocks.startProviderLocationTracking).not.toHaveBeenCalled()
    expect(trackEventMock).toHaveBeenCalledWith('location_permission_denied', {
      user_role: 'provider',
      source: 'explainer_confirm_pending',
    })
  })

  it('skips dialog when permission already granted', async () => {
    locationMocks.getOperationalLocationPermissionStatus.mockResolvedValue('granted')
    const { result } = renderHook(() => useLocationPermissionDialog())

    await waitFor(
      () => expect(locationMocks.getOperationalLocationPermissionStatus).toHaveBeenCalled(),
      { timeout: 2000 },
    )
    expect(result.current.open).toBe(false)
    expect(storageMocks.markLocationPromptSeen).toHaveBeenCalled()
    expect(storageMocks.setStoredLocationPermissionGranted).toHaveBeenCalledWith(true)
  })
})
