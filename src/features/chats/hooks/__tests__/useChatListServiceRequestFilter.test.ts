// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useChatListServiceRequestFilter } from '../useChatListServiceRequestFilter'

function createWrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      children
    )
  }
}

describe('useChatListServiceRequestFilter', () => {
  it('reads the service request id from the URL', () => {
    const { result } = renderHook(() => useChatListServiceRequestFilter(), {
      wrapper: createWrapper('/dashboard/chats?serviceRequestId=request-1'),
    })

    expect(result.current.serviceRequestId).toBe('request-1')
  })

  it('clears only the service request filter', async () => {
    const { result } = renderHook(
      () => ({
        filter: useChatListServiceRequestFilter(),
        location: useLocation(),
      }),
      {
        wrapper: createWrapper(
          '/dashboard/chats?serviceRequestId=request-1&source=notification'
        ),
      }
    )

    act(() => result.current.filter.clearFilter())

    await waitFor(() =>
      expect(result.current.filter.serviceRequestId).toBeNull()
    )
    expect(result.current.location.search).toBe('?source=notification')
  })
})
