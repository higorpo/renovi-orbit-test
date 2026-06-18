import { Capacitor } from '@capacitor/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LocationPermissionDialog } from '../LocationPermissionDialog'

vi.mock('@/hooks/useMobileDialogViewport', () => ({
  useMobileDialogViewport: () => ({ contentRef: { current: null }, scheduleSync: vi.fn() }),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}))

describe('LocationPermissionDialog', () => {
  it('renders explainer copy and action buttons on web', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)

    render(
      <LocationPermissionDialog
        open
        onOpenChange={vi.fn()}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        requesting={false}
      />,
    )

    expect(screen.getByText('Localização para oportunidades')).toBeInTheDocument()
    expect(screen.getByText(/20 km/)).toBeInTheDocument()
    expect(screen.getByText(/baixa frequência/i)).toBeInTheDocument()
    expect(screen.queryByText(/em segundo plano/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument()
  })

  it('discloses background location on native apps', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)

    render(
      <LocationPermissionDialog
        open
        onOpenChange={vi.fn()}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        requesting={false}
      />,
    )

    expect(screen.getByText(/em segundo plano/i)).toBeInTheDocument()
    expect(screen.getByText(/app minimizado/i)).toBeInTheDocument()
    expect(screen.getByText(/notificação persistente/i)).toBeInTheDocument()
  })

  it('calls onDismiss when declining', () => {
    const onDismiss = vi.fn()
    render(
      <LocationPermissionDialog
        open
        onOpenChange={vi.fn()}
        onAccept={vi.fn()}
        onDismiss={onDismiss}
        requesting={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('calls onAccept when continuing', () => {
    const onAccept = vi.fn()
    render(
      <LocationPermissionDialog
        open
        onOpenChange={vi.fn()}
        onAccept={onAccept}
        onDismiss={vi.fn()}
        requesting={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onAccept).toHaveBeenCalled()
  })
})
