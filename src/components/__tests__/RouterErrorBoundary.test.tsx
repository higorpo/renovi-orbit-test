import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/capacitor', () => ({
  CapacitorSplashHider: () => <div data-testid="capacitor-splash-hider" />,
}))

vi.mock('@/lib/sentry', () => ({
  captureException: vi.fn(() => 'event-123'),
  captureUserFeedback: vi.fn(),
}))

import * as ReactRouter from 'react-router'
import { captureException, captureUserFeedback } from '@/lib/sentry'
import { RouterErrorBoundary } from '../RouterErrorBoundary'

function ThrowingPage(): never {
  throw new Error('route exploded')
}

describe('RouterErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders CapacitorSplashHider when a route throws', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <ThrowingPage />,
          errorElement: <RouterErrorBoundary />,
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByTestId('capacitor-splash-hider')).toBeInTheDocument()
    })
    expect(screen.getByText('Erro ao carregar a página')).toBeInTheDocument()
    expect(screen.getByText('route exploded')).toBeInTheDocument()
    expect(captureException).toHaveBeenCalled()
  })

  it('shows generic message for non-Error throwables', async () => {
    function ThrowString(): never {
      throw 'plain failure'
    }

    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <ThrowString />,
          errorElement: <RouterErrorBoundary />,
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    })
  })

  it('submits optional feedback when event id is present', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <ThrowingPage />,
          errorElement: <RouterErrorBoundary />,
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/O que você estava fazendo/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/O que você estava fazendo/i), {
      target: { value: 'testing' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar feedback/i }))

    expect(captureUserFeedback).toHaveBeenCalledWith({
      event_id: 'event-123',
      comments: 'testing',
      email: undefined,
    })
    expect(screen.getByText(/Obrigado pelo feedback/i)).toBeInTheDocument()
  })

  it('uses default feedback comment when comments field is empty', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <ThrowingPage />,
          errorElement: <RouterErrorBoundary />,
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enviar feedback/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Enviar feedback/i }))

    expect(captureUserFeedback).toHaveBeenCalledWith({
      event_id: 'event-123',
      comments: '(sem descrição)',
      email: undefined,
    })
  })

  it('falls back to generic message when error is not a route response or Error', () => {
    vi.spyOn(ReactRouter, 'useRouteError').mockReturnValue({
      status: 500,
      statusText: 'Server Error',
      data: { detail: 'failed' },
    })

    render(<RouterErrorBoundary />)

    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: '[object Object]' }),
      expect.objectContaining({ isRouteErrorResponse: false }),
    )
  })

  it('renders response body when loader throws a Response', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: () => {
            throw new Response('Página não encontrada', { status: 404, statusText: 'Not Found' })
          },
          element: <div>never</div>,
          errorElement: <RouterErrorBoundary />,
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('Página não encontrada')).toBeInTheDocument()
    })
  })

  it('includes email when provided in feedback form', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <ThrowingPage />,
          errorElement: <RouterErrorBoundary />,
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Seu e-mail/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Seu e-mail/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar feedback/i }))

    expect(captureUserFeedback).toHaveBeenCalledWith({
      event_id: 'event-123',
      comments: '(sem descrição)',
      email: 'user@example.com',
    })
  })

  it('submits feedback with empty fields when form inputs are missing', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <ThrowingPage />,
          errorElement: <RouterErrorBoundary />,
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enviar feedback/i })).toBeInTheDocument()
    })

    const form = screen.getByRole('button', { name: /Enviar feedback/i }).closest('form')
    expect(form).not.toBeNull()
    vi.spyOn(form!.elements, 'namedItem').mockReturnValue(null)

    fireEvent.click(screen.getByRole('button', { name: /Enviar feedback/i }))

    expect(captureUserFeedback).toHaveBeenCalledWith({
      event_id: 'event-123',
      comments: '(sem descrição)',
      email: undefined,
    })
  })

  it('redirects to home when clicking voltar ao início', () => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    vi.spyOn(ReactRouter, 'useRouteError').mockReturnValue(new Error('fail'))

    render(<RouterErrorBoundary />)

    fireEvent.click(screen.getByRole('button', { name: /Voltar ao início/i }))
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('does not submit feedback when event id is missing', async () => {
    vi.mocked(captureException).mockReturnValueOnce(undefined)

    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <ThrowingPage />,
          errorElement: <RouterErrorBoundary />,
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('route exploded')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Enviar feedback/i })).not.toBeInTheDocument()
  })
})
