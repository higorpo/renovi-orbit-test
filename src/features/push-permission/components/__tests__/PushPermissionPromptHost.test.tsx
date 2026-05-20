import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const hookMocks = vi.hoisted(() => ({
  open: true,
  requesting: false,
  userRole: 'client' as const,
  setOpen: vi.fn(),
  dismiss: vi.fn(),
  acceptAndRequestPermission: vi.fn(),
}))

vi.mock('../../hooks/usePushPermissionPrompt', () => ({
  usePushPermissionPrompt: () => hookMocks,
}))

vi.mock('../PushPermissionPromptDialog', () => ({
  PushPermissionPromptDialog: (props: {
    onAccept: () => void
    onDismiss: () => void
    onOpenChange: (open: boolean) => void
  }) => (
    <div>
      <button type="button" onClick={props.onAccept}>
        accept
      </button>
      <button type="button" onClick={props.onDismiss}>
        dismiss
      </button>
      <button type="button" onClick={() => props.onOpenChange(false)}>
        close
      </button>
    </div>
  ),
}))

import { PushPermissionPromptHost } from '../PushPermissionPromptHost'

describe('PushPermissionPromptHost', () => {
  it('wires hook callbacks to dialog', () => {
    render(<PushPermissionPromptHost />)

    fireEvent.click(screen.getByRole('button', { name: 'accept' }))
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
    fireEvent.click(screen.getByRole('button', { name: 'close' }))

    expect(hookMocks.acceptAndRequestPermission).toHaveBeenCalled()
    expect(hookMocks.dismiss).toHaveBeenCalled()
    expect(hookMocks.setOpen).toHaveBeenCalledWith(false)
  })
})
