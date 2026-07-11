import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  profile: { role: 'client' as const },
  loadingSession: false,
}))

const pushMocks = vi.hoisted(() => ({
  getPushPermissionStatus: vi.fn(),
  setupPushNotifications: vi.fn(),
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => authMocks,
}))

vi.mock('@/lib/push', () => ({
  isPushPermissionPending: (status: string) => status === 'default' || status === 'prompt',
  getPushPermissionStatus: pushMocks.getPushPermissionStatus,
  setupPushNotifications: pushMocks.setupPushNotifications,
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn() },
}))

const sequenceMocks = vi.hoisted(() => ({
  waitForProviderLocationPermissionFlow: vi.fn(async () => undefined),
}))

vi.mock('@/lib/providerPermissionSequence', () => sequenceMocks)

vi.mock('../../utils/pushPermissionPrompt.storage', () => ({
  isPushPermissionPromptDismissed: vi.fn(async () => false),
  markPushPermissionPromptDismissed: vi.fn(),
  clearPushPermissionPromptDismissed: vi.fn(),
}))

import {
  clearPushPermissionPromptDismissed,
  isPushPermissionPromptDismissed,
  markPushPermissionPromptDismissed,
} from '../../utils/pushPermissionPrompt.storage'
import { usePushPermissionPrompt } from '../usePushPermissionPrompt'

describe('usePushPermissionPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.user = { id: 'user-1' }
    authMocks.profile = { role: 'client' }
    authMocks.loadingSession = false
    sequenceMocks.waitForProviderLocationPermissionFlow.mockResolvedValue(undefined)
    pushMocks.getPushPermissionStatus.mockResolvedValue('default')
    pushMocks.setupPushNotifications.mockResolvedValue({
      platform: 'web',
      token: 'token',
      permission: 'granted',
    })
    vi.mocked(isPushPermissionPromptDismissed).mockResolvedValue(false)
  })

  it('opens dialog when permission is pending', async () => {
    const { result } = renderHook(() => usePushPermissionPrompt())

    await waitFor(() => expect(result.current.open).toBe(true), { timeout: 2000 })
    expect(result.current.userRole).toBe('client')
    expect(sequenceMocks.waitForProviderLocationPermissionFlow).not.toHaveBeenCalled()
  })

  it('waits for provider location flow before evaluating push prompt', async () => {
    authMocks.profile = { role: 'provider' }
    let releaseLocationFlow: (() => void) | undefined
    sequenceMocks.waitForProviderLocationPermissionFlow.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseLocationFlow = resolve
        }),
    )

    const { result } = renderHook(() => usePushPermissionPrompt())

    await waitFor(() => expect(sequenceMocks.waitForProviderLocationPermissionFlow).toHaveBeenCalled())
    expect(result.current.open).toBe(false)

    releaseLocationFlow?.()
    await waitFor(() => expect(result.current.open).toBe(true), { timeout: 2000 })
  })

  it('does not open when permission is denied', async () => {
    pushMocks.getPushPermissionStatus.mockResolvedValue('denied')
    const { result } = renderHook(() => usePushPermissionPrompt())

    await waitFor(() => expect(pushMocks.getPushPermissionStatus).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 700))
    expect(result.current.open).toBe(false)
    expect(clearPushPermissionPromptDismissed).not.toHaveBeenCalled()
  })

  it('does not open while session is loading', async () => {
    authMocks.loadingSession = true
    const { result } = renderHook(() => usePushPermissionPrompt())

    await new Promise((r) => setTimeout(r, 700))
    expect(result.current.open).toBe(false)
    expect(pushMocks.getPushPermissionStatus).not.toHaveBeenCalled()
  })

  it('does not open when permission is already granted', async () => {
    pushMocks.getPushPermissionStatus.mockResolvedValue('granted')
    const { result } = renderHook(() => usePushPermissionPrompt())

    await waitFor(() => expect(pushMocks.getPushPermissionStatus).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 700))
    expect(result.current.open).toBe(false)
    expect(clearPushPermissionPromptDismissed).toHaveBeenCalled()
  })

  it('does not open when user dismissed soft prompt', async () => {
    vi.mocked(isPushPermissionPromptDismissed).mockResolvedValue(true)
    const { result } = renderHook(() => usePushPermissionPrompt())

    await waitFor(() => expect(pushMocks.getPushPermissionStatus).toHaveBeenCalled())
    expect(result.current.open).toBe(false)
  })

  it('dismiss marks storage and closes dialog', async () => {
    const { result } = renderHook(() => usePushPermissionPrompt())

    await waitFor(() => expect(result.current.open).toBe(true), { timeout: 2000 })

    act(() => {
      result.current.dismiss()
    })

    expect(markPushPermissionPromptDismissed).toHaveBeenCalled()
    expect(result.current.open).toBe(false)
  })

  it('keeps dialog closed when user is absent', async () => {
    authMocks.user = null
    const { result } = renderHook(() => usePushPermissionPrompt())

    await new Promise((r) => setTimeout(r, 700))
    expect(result.current.open).toBe(false)
    expect(pushMocks.getPushPermissionStatus).not.toHaveBeenCalled()
  })

  it('dismisses softly when user refuses OS permission', async () => {
    pushMocks.setupPushNotifications.mockResolvedValueOnce({
      platform: 'android',
      token: null,
      permission: 'denied',
    })
    const { result } = renderHook(() => usePushPermissionPrompt())

    await waitFor(() => expect(result.current.open).toBe(true), { timeout: 2000 })

    await act(async () => {
      await result.current.acceptAndRequestPermission()
    })

    expect(markPushPermissionPromptDismissed).toHaveBeenCalled()
    expect(result.current.open).toBe(false)
  })

  it('closes after failed request when user is no longer present', async () => {
    const { result, rerender } = renderHook(() => usePushPermissionPrompt())

    await waitFor(() => expect(result.current.open).toBe(true), { timeout: 2000 })

    authMocks.user = null
    rerender()
    pushMocks.setupPushNotifications.mockRejectedValueOnce('blocked')

    await act(async () => {
      await result.current.acceptAndRequestPermission()
    })

    expect(result.current.open).toBe(false)
  })

  it('accept requests permission after dismissing the in-app dialog', async () => {
    const { result } = renderHook(() => usePushPermissionPrompt())

    await waitFor(() => expect(result.current.open).toBe(true), { timeout: 2000 })

    act(() => {
      void result.current.acceptAndRequestPermission()
    })

    expect(result.current.open).toBe(false)

    await waitFor(
      () => {
        expect(pushMocks.setupPushNotifications).toHaveBeenCalledWith(undefined, {
          requestPermission: true,
        })
      },
      { timeout: 2000 },
    )

    expect(clearPushPermissionPromptDismissed).toHaveBeenCalled()
    expect(result.current.open).toBe(false)
  })

  it('marks dismissed and logs when permission request throws', async () => {
    const { logger } = await import('@/lib/logger')
    pushMocks.setupPushNotifications.mockRejectedValueOnce(new Error('blocked'))
    const { result } = renderHook(() => usePushPermissionPrompt())

    await waitFor(() => expect(result.current.open).toBe(true), { timeout: 2000 })

    await act(async () => {
      await result.current.acceptAndRequestPermission()
    })

    expect(logger.warn).toHaveBeenCalledWith(
      'push_permission_request_failed',
      expect.objectContaining({ message: 'blocked' }),
    )
    expect(markPushPermissionPromptDismissed).toHaveBeenCalled()
    expect(result.current.requesting).toBe(false)
    expect(result.current.open).toBe(false)
  })
})
