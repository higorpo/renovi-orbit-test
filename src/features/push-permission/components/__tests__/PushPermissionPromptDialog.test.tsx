import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useMobileDialogViewport', () => ({
  useMobileDialogViewport: () => ({ contentRef: { current: null }, scheduleSync: vi.fn() }),
}))

import { PushPermissionPromptDialog } from '../PushPermissionPromptDialog'

describe('PushPermissionPromptDialog', () => {
  it('renders client copy and handles actions', () => {
    const onAccept = vi.fn()
    const onDismiss = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <PushPermissionPromptDialog
        open
        onOpenChange={onOpenChange}
        onAccept={onAccept}
        onDismiss={onDismiss}
        requesting={false}
        userRole="client"
      />,
    )

    expect(screen.getByText(/novo orçamento/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /agora não/i }))
    expect(onDismiss).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    expect(onAccept).toHaveBeenCalled()
  })

  it('renders provider-specific copy', () => {
    render(
      <PushPermissionPromptDialog
        open
        onOpenChange={vi.fn()}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        requesting={false}
        userRole="provider"
      />,
    )

    expect(screen.getByText(/novo pedido na sua área/i)).toBeInTheDocument()
  })

  it('dismisses when dialog closes via escape while idle', () => {
    const onDismiss = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <PushPermissionPromptDialog
        open
        onOpenChange={onOpenChange}
        onAccept={vi.fn()}
        onDismiss={onDismiss}
        requesting={false}
        userRole="client"
      />,
    )

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(onDismiss).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not dismiss via overlay while requesting', () => {
    const onDismiss = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <PushPermissionPromptDialog
        open
        onOpenChange={onOpenChange}
        onAccept={vi.fn()}
        onDismiss={onDismiss}
        requesting
        userRole="client"
      />,
    )

    onOpenChange(false)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('renders default copy for admin role', () => {
    render(
      <PushPermissionPromptDialog
        open
        onOpenChange={vi.fn()}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        requesting={false}
        userRole="admin"
      />,
    )

    expect(screen.getByText(/atualizações de pedidos/i)).toBeInTheDocument()
  })

  it('closes via header close button', () => {
    const onDismiss = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <PushPermissionPromptDialog
        open
        onOpenChange={onOpenChange}
        onAccept={vi.fn()}
        onDismiss={onDismiss}
        requesting={false}
        userRole="client"
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: /fechar/i })[0]!)
    expect(onDismiss).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows loading state on accept button', () => {
    render(
      <PushPermissionPromptDialog
        open
        onOpenChange={vi.fn()}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        requesting
        userRole="client"
      />,
    )

    expect(screen.getByRole('button', { name: /ativando/i })).toBeDisabled()
  })
})
