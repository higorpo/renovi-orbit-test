import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useOnlineStatus = vi.fn()

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => useOnlineStatus(),
}))

import { OfflineBanner } from '../OfflineBanner'

describe('OfflineBanner', () => {
  beforeEach(() => {
    useOnlineStatus.mockReset()
  })

  it('renders nothing when online', () => {
    useOnlineStatus.mockReturnValue(true)
    const { container } = render(<OfflineBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows alert banner and spacer when offline', () => {
    useOnlineStatus.mockReturnValue(false)
    render(<OfflineBanner />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/sem conexão com a internet/i)
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })
})
