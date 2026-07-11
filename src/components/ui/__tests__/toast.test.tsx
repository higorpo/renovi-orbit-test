import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '../toast'

describe('toast', () => {
  it('renders default and destructive variants with action and close', async () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastTitle>Salvo</ToastTitle>
          <ToastDescription>Alterações aplicadas.</ToastDescription>
          <ToastAction altText="Desfazer">Desfazer</ToastAction>
          <ToastClose />
        </Toast>
        <Toast open variant="destructive">
          <ToastTitle>Erro</ToastTitle>
          <ToastDescription>Falhou.</ToastDescription>
        </Toast>
        <ToastViewport className="custom-viewport" />
      </ToastProvider>,
    )

    expect(screen.getByText('Salvo')).toBeInTheDocument()
    expect(screen.getByText('Alterações aplicadas.')).toBeInTheDocument()
    expect(screen.getByText('Erro')).toBeInTheDocument()
    expect(screen.getByText('Desfazer')).toBeInTheDocument()
  })

  it('invokes onOpenChange when closed', async () => {
    const onOpenChange = vi.fn()
    render(
      <ToastProvider>
        <Toast open onOpenChange={onOpenChange}>
          <ToastTitle>Aviso</ToastTitle>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalled()
    })
  })
})
