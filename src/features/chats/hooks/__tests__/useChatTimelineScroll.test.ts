// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatTimelineScroll } from '../useChatTimelineScroll'

const {
  anchorBeforeKeyboardMock,
  clearStickToBottomIfScrolledUpMock,
  markStickToBottomMock,
  syncNearBottomFromScrollMock,
} = vi.hoisted(() => ({
  anchorBeforeKeyboardMock: vi.fn(),
  clearStickToBottomIfScrolledUpMock: vi.fn(),
  markStickToBottomMock: vi.fn(),
  syncNearBottomFromScrollMock: vi.fn(),
}))

vi.mock('../useSnapChatTimelineOnKeyboardOpen', () => ({
  useSnapChatTimelineOnKeyboardOpen: () => ({
    anchorBeforeKeyboard: anchorBeforeKeyboardMock,
    syncNearBottomFromScroll: syncNearBottomFromScrollMock,
  }),
}))

vi.mock('../useChatTimelineStickToBottomOnResize', () => ({
  useChatTimelineStickToBottomOnResize: () => ({
    markStickToBottom: markStickToBottomMock,
    clearStickToBottomIfScrolledUp: clearStickToBottomIfScrolledUpMock,
  }),
}))

const baseProps = {
  resetKey: 'chat-1',
  isLoading: true,
  timelineItemCount: 1,
  lastTimelineMessageKey: 'message-1',
  lastMessageId: 'message-1',
  actionBannerTopInset: 0,
  snapOnKeyboardOpen: true,
}

describe('useChatTimelineScroll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('scrolls to the latest item once initial loading finishes', () => {
    const scrollIntoView = vi.fn()
    const { result, rerender } = renderHook(
      (props: typeof baseProps) => useChatTimelineScroll(props),
      { initialProps: baseProps }
    )
    act(() => {
      result.current.bottomRef.current = {
        scrollIntoView,
      } as unknown as HTMLDivElement
    })

    rerender({ ...baseProps, isLoading: false })

    expect(markStickToBottomMock).toHaveBeenCalledOnce()
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'end',
      behavior: 'auto',
    })

    rerender({ ...baseProps, isLoading: false, timelineItemCount: 2 })
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('preserves the distance from the bottom across a layout shift', () => {
    const animationFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })
    const scrollElement = document.createElement('div')
    Object.defineProperties(scrollElement, {
      scrollHeight: { value: 500, configurable: true },
      scrollTop: { value: 350, writable: true, configurable: true },
      clientHeight: { value: 100, configurable: true },
    })
    const { result } = renderHook(() => useChatTimelineScroll(baseProps))
    act(() => {
      result.current.scrollRef.current = scrollElement
      result.current.preserveScrollOnLayoutShift()
    })

    Object.defineProperty(scrollElement, 'scrollHeight', {
      value: 650,
      configurable: true,
    })
    act(() => animationFrames.shift()?.(0))

    expect(scrollElement.scrollTop).toBe(500)
  })

  it('forwards focus and scroll events to keyboard and resize coordination', () => {
    const { result } = renderHook(() => useChatTimelineScroll(baseProps))

    act(() => {
      result.current.onComposerFocus()
      result.current.onTimelineScroll()
    })

    expect(anchorBeforeKeyboardMock).toHaveBeenCalledOnce()
    expect(clearStickToBottomIfScrolledUpMock).toHaveBeenCalledOnce()
    expect(syncNearBottomFromScrollMock).toHaveBeenCalledOnce()
  })

  it('resets initial scroll when resetKey changes', () => {
    const scrollIntoView = vi.fn()
    const { result, rerender } = renderHook(
      (props: typeof baseProps) => useChatTimelineScroll(props),
      { initialProps: baseProps }
    )
    act(() => {
      result.current.bottomRef.current = {
        scrollIntoView,
      } as unknown as HTMLDivElement
    })

    rerender({ ...baseProps, isLoading: false })
    const callsAfterLoad = scrollIntoView.mock.calls.length
    expect(callsAfterLoad).toBeGreaterThanOrEqual(1)

    rerender({
      ...baseProps,
      isLoading: false,
      resetKey: 'chat-2',
      timelineItemCount: 2,
    })
    expect(scrollIntoView.mock.calls.length).toBeGreaterThan(callsAfterLoad)
  })

  it('skips initial scroll while the timeline is empty', () => {
    const scrollIntoView = vi.fn()
    const { result, rerender } = renderHook(
      (props: typeof baseProps) => useChatTimelineScroll(props),
      {
        initialProps: {
          ...baseProps,
          isLoading: false,
          timelineItemCount: 0,
        },
      }
    )
    act(() => {
      result.current.bottomRef.current = {
        scrollIntoView,
      } as unknown as HTMLDivElement
    })

    expect(scrollIntoView).not.toHaveBeenCalled()

    rerender({ ...baseProps, isLoading: false, timelineItemCount: 1 })
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('clears action-banner inset by adjusting scrollTop after initial scroll', () => {
    const animationFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })

    const lastMessage = document.createElement('div')
    lastMessage.setAttribute('data-chat-timeline-last', 'true')
    Object.defineProperty(lastMessage, 'offsetTop', {
      value: 400,
      configurable: true,
    })

    const scrollElement = document.createElement('div')
    scrollElement.appendChild(lastMessage)
    Object.defineProperties(scrollElement, {
      scrollHeight: { value: 500, configurable: true },
      scrollTop: { value: 0, writable: true, configurable: true },
      clientHeight: { value: 100, configurable: true },
    })

    const scrollIntoView = vi.fn()
    const { result, rerender } = renderHook(
      (props: typeof baseProps) => useChatTimelineScroll(props),
      { initialProps: { ...baseProps, isLoading: false, actionBannerTopInset: 0 } }
    )

    act(() => {
      result.current.scrollRef.current = scrollElement
      result.current.bottomRef.current = {
        scrollIntoView,
      } as unknown as HTMLDivElement
    })

    rerender({
      ...baseProps,
      isLoading: false,
      actionBannerTopInset: 80,
    })

    act(() => {
      while (animationFrames.length > 0) {
        animationFrames.shift()?.(0)
      }
    })

    expect(scrollElement.scrollTop).toBe(320)
  })

  it('no-ops preserveScrollOnLayoutShift when the scroll element is missing', () => {
    const animationFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })
    const { result } = renderHook(() => useChatTimelineScroll(baseProps))

    act(() => {
      result.current.preserveScrollOnLayoutShift()
    })

    expect(animationFrames).toHaveLength(0)
  })

  it('skips banner clearance when the last message node is missing', () => {
    const animationFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })

    const scrollElement = document.createElement('div')
    Object.defineProperties(scrollElement, {
      scrollHeight: { value: 500, configurable: true },
      scrollTop: { value: 0, writable: true, configurable: true },
      clientHeight: { value: 100, configurable: true },
    })

    const scrollIntoView = vi.fn()
    const { result, rerender } = renderHook(
      (props: typeof baseProps) => useChatTimelineScroll(props),
      { initialProps: { ...baseProps, isLoading: false, actionBannerTopInset: 0 } }
    )

    act(() => {
      result.current.scrollRef.current = scrollElement
      result.current.bottomRef.current = {
        scrollIntoView,
      } as unknown as HTMLDivElement
    })

    rerender({
      ...baseProps,
      isLoading: false,
      actionBannerTopInset: 80,
    })

    act(() => {
      while (animationFrames.length > 0) {
        animationFrames.shift()?.(0)
      }
    })

    expect(scrollElement.scrollTop).toBe(0)
  })

  it('does not raise scrollTop when already past the banner clearance', () => {
    const animationFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })

    const lastMessage = document.createElement('div')
    lastMessage.setAttribute('data-chat-timeline-last', 'true')
    Object.defineProperty(lastMessage, 'offsetTop', {
      value: 400,
      configurable: true,
    })

    const scrollElement = document.createElement('div')
    scrollElement.appendChild(lastMessage)
    Object.defineProperties(scrollElement, {
      scrollHeight: { value: 500, configurable: true },
      scrollTop: { value: 350, writable: true, configurable: true },
      clientHeight: { value: 100, configurable: true },
    })

    const scrollIntoView = vi.fn()
    const { result, rerender } = renderHook(
      (props: typeof baseProps) => useChatTimelineScroll(props),
      { initialProps: { ...baseProps, isLoading: false, actionBannerTopInset: 0 } }
    )

    act(() => {
      result.current.scrollRef.current = scrollElement
      result.current.bottomRef.current = {
        scrollIntoView,
      } as unknown as HTMLDivElement
    })

    rerender({
      ...baseProps,
      isLoading: false,
      actionBannerTopInset: 80,
    })

    act(() => {
      while (animationFrames.length > 0) {
        animationFrames.shift()?.(0)
      }
    })

    expect(scrollElement.scrollTop).toBe(350)
  })

  it('skips deferred layout preservation when the scroll element is detached', () => {
    const animationFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })
    const scrollElement = document.createElement('div')
    Object.defineProperties(scrollElement, {
      scrollHeight: { value: 500, configurable: true },
      scrollTop: { value: 350, writable: true, configurable: true },
      clientHeight: { value: 100, configurable: true },
    })
    const { result } = renderHook(() => useChatTimelineScroll(baseProps))

    act(() => {
      result.current.scrollRef.current = scrollElement
      result.current.preserveScrollOnLayoutShift()
      result.current.scrollRef.current = null
      animationFrames.shift()?.(0)
    })

    expect(scrollElement.scrollTop).toBe(350)
  })

  it('clamps banner clearance scrollTop to zero', () => {
    const animationFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })
    const lastMessage = document.createElement('div')
    lastMessage.setAttribute('data-chat-timeline-last', 'true')
    Object.defineProperty(lastMessage, 'offsetTop', { value: 20, configurable: true })
    const scrollElement = document.createElement('div')
    scrollElement.appendChild(lastMessage)
    Object.defineProperties(scrollElement, {
      scrollHeight: { value: 100, configurable: true },
      scrollTop: { value: -100, writable: true, configurable: true },
      clientHeight: { value: 100, configurable: true },
    })
    const { result, rerender } = renderHook(
      (props: typeof baseProps) => useChatTimelineScroll(props),
      { initialProps: { ...baseProps, actionBannerTopInset: 0 } }
    )

    act(() => {
      result.current.scrollRef.current = scrollElement
      result.current.bottomRef.current = {
        scrollIntoView: vi.fn(),
      } as unknown as HTMLDivElement
    })
    rerender({ ...baseProps, isLoading: false, actionBannerTopInset: 80 })
    act(() => {
      while (animationFrames.length) animationFrames.shift()?.(0)
    })

    expect(scrollElement.scrollTop).toBe(0)
  })
})
