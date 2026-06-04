// @vitest-environment happy-dom

import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  closeTopOverlay,
  hasOpenOverlay,
  registerOverlayClose,
  useOverlayOpenChange,
} from '@/lib/overlayHistory'

describe('overlayHistory', () => {
  it('tracks open overlays in a stack', () => {
    const onClose = vi.fn()
    const release = registerOverlayClose(onClose)

    expect(hasOpenOverlay()).toBe(true)

    release()
    expect(hasOpenOverlay()).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes the top overlay via closeTopOverlay', () => {
    const onCloseOuter = vi.fn()
    const onCloseInner = vi.fn()

    registerOverlayClose(onCloseOuter)
    registerOverlayClose(onCloseInner)

    expect(closeTopOverlay()).toBe(true)
    expect(onCloseInner).toHaveBeenCalledTimes(1)
    expect(onCloseOuter).not.toHaveBeenCalled()
    expect(hasOpenOverlay()).toBe(true)

    expect(closeTopOverlay()).toBe(true)
    expect(onCloseOuter).toHaveBeenCalledTimes(1)
    expect(hasOpenOverlay()).toBe(false)
  })

  it('registers when a controlled overlay opens', () => {
    const onOpenChange = vi.fn()

    const { unmount } = renderHook(() =>
      useOverlayOpenChange(true, onOpenChange)
    )

    expect(hasOpenOverlay()).toBe(true)

    act(() => {
      closeTopOverlay()
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(hasOpenOverlay()).toBe(false)

    unmount()
  })

  it('unregisters when a controlled overlay closes', () => {
    const onOpenChange = vi.fn()

    const { rerender } = renderHook(
      ({ open }) => useOverlayOpenChange(open, onOpenChange),
      { initialProps: { open: true } }
    )

    expect(hasOpenOverlay()).toBe(true)

    rerender({ open: false })

    expect(hasOpenOverlay()).toBe(false)
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
