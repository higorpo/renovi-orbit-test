// @vitest-environment happy-dom

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OverlayNavigationBlocker } from '@/components/OverlayNavigationBlocker'
import * as overlayHistory from '@/lib/overlayHistory'

const reset = vi.fn()
const useBlocker = vi.fn()

vi.mock('@/lib/overlayHistory', async (importOriginal) => {
  const actual = await importOriginal<typeof overlayHistory>()
  return {
    ...actual,
    closeTopOverlay: vi.fn(() => true),
    useHasOpenOverlay: vi.fn(() => true),
  }
})

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useBlocker: (...args: unknown[]) => useBlocker(...args),
  }
})

describe('OverlayNavigationBlocker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(overlayHistory.useHasOpenOverlay).mockReturnValue(true)
    useBlocker.mockReturnValue({
      state: 'unblocked',
      reset,
      proceed: vi.fn(),
    })
  })

  it('renders without crashing when overlay is open', () => {
    expect(() => render(<OverlayNavigationBlocker />)).not.toThrow()
    expect(useBlocker).toHaveBeenCalled()
  })

  it('closes top overlay and resets blocker when navigation is blocked', () => {
    useBlocker.mockReturnValue({
      state: 'blocked',
      reset,
      proceed: vi.fn(),
    })

    render(<OverlayNavigationBlocker />)

    expect(overlayHistory.closeTopOverlay).toHaveBeenCalled()
    expect(reset).toHaveBeenCalled()
  })

  it('does not close overlay when blocker is not blocked', () => {
    useBlocker.mockReturnValue({
      state: 'unblocked',
      reset,
      proceed: vi.fn(),
    })

    render(<OverlayNavigationBlocker />)

    expect(overlayHistory.closeTopOverlay).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
  })

  it('passes a shouldBlock callback that only blocks POP when overlay is open', () => {
    vi.mocked(overlayHistory.useHasOpenOverlay).mockReturnValue(true)
    render(<OverlayNavigationBlocker />)

    const shouldBlock = useBlocker.mock.calls[0]?.[0] as (args: {
      historyAction: string
    }) => boolean
    expect(shouldBlock({ historyAction: 'POP' })).toBe(true)
    expect(shouldBlock({ historyAction: 'PUSH' })).toBe(false)

    vi.mocked(overlayHistory.useHasOpenOverlay).mockReturnValue(false)
    render(<OverlayNavigationBlocker />)
    const shouldBlockClosed = useBlocker.mock.calls.at(-1)?.[0] as (args: {
      historyAction: string
    }) => boolean
    expect(shouldBlockClosed({ historyAction: 'POP' })).toBe(false)
  })
})
