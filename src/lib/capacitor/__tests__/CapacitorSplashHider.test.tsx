import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hideMocks = vi.hoisted(() => ({
  hideCapacitorSplash: vi.fn(),
  applyNativeSystemBarsStyle: vi.fn(),
}))

vi.mock('../hideCapacitorSplash', () => ({
  hideCapacitorSplash: hideMocks.hideCapacitorSplash,
}))

vi.mock('../initCapacitorPlugins', () => ({
  applyNativeSystemBarsStyle: hideMocks.applyNativeSystemBarsStyle,
}))

import {
  CapacitorSplashHider,
  resetCapacitorSplashHiderForTests,
} from '../CapacitorSplashHider'

describe('CapacitorSplashHider', () => {
  beforeEach(() => {
    resetCapacitorSplashHiderForTests()
    vi.clearAllMocks()
  })

  it('renders nothing', () => {
    const { container } = render(<CapacitorSplashHider />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides splash then applies native system bars on mount', async () => {
    hideMocks.hideCapacitorSplash.mockResolvedValue(undefined)
    hideMocks.applyNativeSystemBarsStyle.mockResolvedValue(undefined)

    render(<CapacitorSplashHider />)

    await waitFor(() => {
      expect(hideMocks.hideCapacitorSplash).toHaveBeenCalled()
      expect(hideMocks.applyNativeSystemBarsStyle).toHaveBeenCalled()
    })
    expect(hideMocks.applyNativeSystemBarsStyle.mock.invocationCallOrder[0]).toBeGreaterThan(
      hideMocks.hideCapacitorSplash.mock.invocationCallOrder[0] ?? -1,
    )
  })

  it('does not run hide logic again on second mount', async () => {
    hideMocks.hideCapacitorSplash.mockResolvedValue(undefined)
    hideMocks.applyNativeSystemBarsStyle.mockResolvedValue(undefined)

    const { unmount } = render(<CapacitorSplashHider />)

    await waitFor(() => {
      expect(hideMocks.hideCapacitorSplash).toHaveBeenCalledTimes(1)
    })

    unmount()
    render(<CapacitorSplashHider />)

    await waitFor(() => {
      expect(hideMocks.applyNativeSystemBarsStyle).toHaveBeenCalledTimes(1)
    })
    expect(hideMocks.hideCapacitorSplash).toHaveBeenCalledTimes(1)
  })
})
