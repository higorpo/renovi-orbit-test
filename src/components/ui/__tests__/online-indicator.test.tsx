import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConnectionStatus, OnlineIndicator } from '../online-indicator'

describe('OnlineIndicator', () => {
  it('renders without tooltip when showTooltip is false', () => {
    const { container } = render(
      <OnlineIndicator isOnline showTooltip={false} />,
    )
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument()
    expect(screen.queryByText(/Online agora/i)).not.toBeInTheDocument()
  })

  it('renders green pulse when online with tooltip enabled', () => {
    const { container } = render(<OnlineIndicator isOnline />)
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument()
    expect(container.querySelector('.animate-ping')).toBeInTheDocument()
  })

  it('renders muted indicator when offline', () => {
    const { container } = render(
      <OnlineIndicator isOnline={false} lastSeen={null} />,
    )
    expect(container.querySelector('.bg-muted-foreground\\/50')).toBeInTheDocument()
    expect(container.querySelector('.animate-ping')).not.toBeInTheDocument()
  })

  it('accepts lastSeen when offline without crashing', () => {
    expect(() =>
      render(
        <OnlineIndicator
          isOnline={false}
          lastSeen={new Date(Date.now() - 60_000).toISOString()}
        />,
      ),
    ).not.toThrow()
  })
})

describe('ConnectionStatus', () => {
  it('maps connecting, connected, and disconnected labels', () => {
    const { rerender } = render(<ConnectionStatus status="connecting" />)
    expect(screen.getByText('Conectando...')).toBeInTheDocument()

    rerender(<ConnectionStatus status="connected" />)
    expect(screen.getByText('Conectado')).toBeInTheDocument()

    rerender(<ConnectionStatus status="disconnected" />)
    expect(screen.getByText('Desconectado')).toBeInTheDocument()
  })
})
