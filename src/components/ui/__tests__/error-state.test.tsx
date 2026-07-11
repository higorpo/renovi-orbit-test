import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorState } from '../error-state'

describe('ErrorState', () => {
  it('renders title and description as an alert', () => {
    render(
      <ErrorState title="Falha" description="Não foi possível carregar" />,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Falha')).toBeInTheDocument()
    expect(screen.getByText('Não foi possível carregar')).toBeInTheDocument()
  })

  it('omits retry button when onRetry is not provided', () => {
    render(<ErrorState title="Falha" description="Erro" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('calls onRetry with custom label when retry is clicked', () => {
    const onRetry = vi.fn()
    render(
      <ErrorState
        title="Falha"
        description="Erro"
        onRetry={onRetry}
        retryLabel="Tentar de novo"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('wraps content in page layout container when pageLayout is true', () => {
    const { container } = render(
      <ErrorState title="Falha" description="Erro" pageLayout />,
    )
    expect(container.querySelector('.container')).toBeInTheDocument()
  })
})
