import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/sentry', () => ({
  captureException: vi.fn(() => 'event-456'),
  captureUserFeedback: vi.fn(),
}))

import { captureException, captureUserFeedback } from '@/lib/sentry'
import { ErrorBoundary } from '../ErrorBoundary'

function ThrowingChild({ message = 'boom' }: { message?: string }): never {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('shows fallback UI and reports to Sentry when a child throws', async () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    await waitFor(() => {
      expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    })
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
      expect.objectContaining({ errorBoundary: true }),
    )
  })

  it('renders custom fallback prop when provided', async () => {
    render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    await waitFor(() => {
      expect(screen.getByText('custom fallback')).toBeInTheDocument()
    })
    expect(screen.queryByText('Algo deu errado')).not.toBeInTheDocument()
  })

  it('submits feedback with comments and email when event id is present', async () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/O que você estava fazendo/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/O que você estava fazendo/i), {
      target: { value: 'clicked save' },
    })
    fireEvent.change(screen.getByLabelText(/Seu e-mail/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar feedback/i }))

    expect(captureUserFeedback).toHaveBeenCalledWith({
      event_id: 'event-456',
      comments: 'clicked save',
      email: 'user@example.com',
    })
    expect(screen.getByText(/Obrigado pelo feedback/i)).toBeInTheDocument()
  })

  it('uses default feedback comment when comments are empty', async () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enviar feedback/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Enviar feedback/i }))

    expect(captureUserFeedback).toHaveBeenCalledWith({
      event_id: 'event-456',
      comments: '(sem descrição)',
      email: undefined,
    })
  })

  it('does not show feedback form when captureException returns no event id', async () => {
    vi.mocked(captureException).mockReturnValueOnce(undefined)

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    await waitFor(() => {
      expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Enviar feedback/i })).not.toBeInTheDocument()
  })

  it('resets state and navigates home when clicking Voltar ao início', async () => {
    const hrefSetter = vi.fn()
    vi.stubGlobal('location', {
      ...window.location,
      set href(value: string) {
        hrefSetter(value)
      },
      get href() {
        return '/'
      },
    })

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Voltar ao início/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Voltar ao início/i }))
    expect(hrefSetter).toHaveBeenCalledWith('/')
  })
})
