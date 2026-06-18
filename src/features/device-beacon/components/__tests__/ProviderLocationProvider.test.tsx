// @vitest-environment happy-dom

import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  user: { id: 'provider-1' } as { id: string } | null,
  profile: { role: 'provider' as 'provider' | 'client' | 'admin' },
  loadingSession: false,
}))

const runtimeMocks = vi.hoisted(() => ({
  startProviderLocationTracking: vi.fn(),
  stopProviderLocationTracking: vi.fn(),
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => authMocks,
}))

vi.mock('../hooks/useLocationPermissionDialog', () => ({
  useLocationPermissionDialog: () => ({
    open: false,
    requesting: false,
    setOpen: vi.fn(),
    dismiss: vi.fn(),
    acceptAndRequestPermission: vi.fn(),
  }),
}))

vi.mock('../../utils/providerLocationTracking.runtime', () => runtimeMocks)

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ProviderLocationProvider } from '../ProviderLocationProvider'

describe('ProviderLocationProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.user = { id: 'provider-1' }
    authMocks.profile = { role: 'provider' }
    authMocks.loadingSession = false
  })

  it('starts location tracking for provider sessions', async () => {
    render(
      <ProviderLocationProvider>
        <span>child</span>
      </ProviderLocationProvider>,
    )

    await waitFor(() =>
      expect(runtimeMocks.startProviderLocationTracking).toHaveBeenCalledWith('provider-1'),
    )
  })

  it('does not start tracking for client sessions', async () => {
    authMocks.profile = { role: 'client' }

    render(
      <ProviderLocationProvider>
        <span>child</span>
      </ProviderLocationProvider>,
    )

    await waitFor(() =>
      expect(runtimeMocks.stopProviderLocationTracking).toHaveBeenCalled(),
    )
    expect(runtimeMocks.startProviderLocationTracking).not.toHaveBeenCalled()
  })
})
