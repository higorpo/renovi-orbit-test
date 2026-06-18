import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/capacitor', () => ({
  CapacitorSplashHider: () => <div data-testid="capacitor-splash-hider" />,
}))

vi.mock('@/features/auth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/features/device-beacon', () => ({
  DeviceBeaconProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/features/push-permission', () => ({
  PushPermissionPromptHost: () => null,
}))

vi.mock('@/components/OfflineBanner', () => ({
  OfflineBanner: () => null,
}))

vi.mock('@/PWABadge', () => ({
  default: () => null,
}))

vi.mock('sonner', () => ({
  Toaster: () => null,
}))

import { RootLayout } from '../RootLayout'

describe('RootLayout', () => {
  it('renders CapacitorSplashHider and child route outlet', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: <RootLayout />,
        children: [{ index: true, element: <div data-testid="child-route">child</div> }],
      },
    ])

    render(<RouterProvider router={router} />)

    expect(screen.getByTestId('capacitor-splash-hider')).toBeInTheDocument()
    expect(screen.getByTestId('child-route')).toBeInTheDocument()
  })
})
