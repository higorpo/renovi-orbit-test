// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useMobileDialogViewport } from '@/hooks/useMobileDialogViewport'
import { setOfflineBannerInsetOnDocument } from '@/lib/offlineBannerInset'

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))

const SM_QUERY = '(max-width: 639px)'

function mockMatchMedia(mobile: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query === SM_QUERY ? mobile : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('useMobileDialogViewport', () => {
  beforeEach(() => {
    document.documentElement.style.fontSize = '16px'
    mockMatchMedia(true)
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        height: 700,
        offsetTop: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.style.removeProperty('--offline-banner-inset')
    document.documentElement.style.removeProperty('font-size')
  })

  it('offsets top and height when offline banner inset is set', () => {
    setOfflineBannerInsetOnDocument(false)

    const el = document.createElement('div')
    const { result } = renderHook(() => useMobileDialogViewport(true))

    act(() => {
      ;(result.current.contentRef as { current: HTMLDivElement | null }).current = el
      result.current.scheduleSync()
    })

    expect(el.style.top).toBe('44px')
    expect(el.style.height).toBe('656px')
  })

  it('uses visual viewport only when online', () => {
    setOfflineBannerInsetOnDocument(true)

    const el = document.createElement('div')
    const { result } = renderHook(() => useMobileDialogViewport(true))

    act(() => {
      ;(result.current.contentRef as { current: HTMLDivElement | null }).current = el
      result.current.scheduleSync()
    })

    expect(el.style.top).toBe('0px')
    expect(el.style.height).toBe('700px')
  })
})
