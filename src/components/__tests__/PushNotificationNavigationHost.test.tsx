import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PUSH_NAVIGATE_MESSAGE_TYPE,
  handlePushNotificationOpen,
  resetPushNavigationForTests,
} from '@/lib/pushNavigation'

const navigate = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { PushNotificationNavigationHost } from '../PushNotificationNavigationHost'

describe('PushNotificationNavigationHost', () => {
  beforeEach(() => {
    navigate.mockReset()
    resetPushNavigationForTests()
  })

  afterEach(() => {
    resetPushNavigationForTests()
  })

  it('registers a handler that navigates to the push path', async () => {
    render(<PushNotificationNavigationHost />)

    await waitFor(() => {
      const path = handlePushNotificationOpen({
        data: { deep_link_path: '/jobs/42' },
      } as never)
      expect(path).toBe('/jobs/42')
    })

    expect(navigate).toHaveBeenCalledWith('/jobs/42')
  })

  it('navigates when service worker posts a push navigate message', async () => {
    const listeners = new Map<string, EventListener>()
    const addEventListener = vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener)
    })
    const removeEventListener = vi.fn((type: string) => {
      listeners.delete(type)
    })

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { addEventListener, removeEventListener },
    })

    const { unmount } = render(<PushNotificationNavigationHost />)

    await waitFor(() => {
      expect(addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    })

    const onMessage = listeners.get('message')
    expect(onMessage).toBeTypeOf('function')

    onMessage?.(
      new MessageEvent('message', {
        data: { type: PUSH_NAVIGATE_MESSAGE_TYPE, path: '/dashboard' },
      }),
    )
    expect(navigate).toHaveBeenCalledWith('/dashboard')

    navigate.mockClear()
    onMessage?.(
      new MessageEvent('message', {
        data: { type: 'other', path: '/ignored' },
      }),
    )
    expect(navigate).not.toHaveBeenCalled()

    onMessage?.(
      new MessageEvent('message', {
        data: { type: PUSH_NAVIGATE_MESSAGE_TYPE },
      }),
    )
    expect(navigate).not.toHaveBeenCalled()

    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('message', expect.any(Function))
  })
})
