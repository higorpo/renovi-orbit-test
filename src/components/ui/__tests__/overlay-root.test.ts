// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const useOverlayOpenChange = vi.fn((_open?: boolean, onOpenChange?: (open: boolean) => void) => onOpenChange)

vi.mock('@/lib/overlayHistory', () => ({
  useOverlayOpenChange: (...args: unknown[]) =>
    useOverlayOpenChange(...(args as [boolean | undefined, ((open: boolean) => void) | undefined])),
}))

import { useOverlayRootProps } from '../overlay-root'

describe('useOverlayRootProps', () => {
  it('returns props with onOpenChange wired through overlay history', () => {
    const onOpenChange = vi.fn()
    const wrapped = vi.fn()
    useOverlayOpenChange.mockReturnValue(wrapped)

    const { result } = renderHook(() =>
      useOverlayRootProps({ open: true, onOpenChange, title: 'sheet' }),
    )

    expect(useOverlayOpenChange).toHaveBeenCalledWith(true, onOpenChange)
    expect(result.current).toEqual({
      open: true,
      onOpenChange: wrapped,
      title: 'sheet',
    })
  })
})
