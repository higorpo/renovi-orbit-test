// @vitest-environment happy-dom

import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __resetOnlineStatusProbeForTests,
  OnlineStatusProvider,
  useOnlineStatus,
} from '../useOnlineStatus'

function ProbeConsumer() {
  const isOnline = useOnlineStatus()
  return <span data-testid="online">{String(isOnline)}</span>
}

describe('useOnlineStatus', () => {
  beforeEach(() => {
    __resetOnlineStatusProbeForTests()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('probes online-check.txt once when provider mounts', async () => {
    render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(fetch).toHaveBeenCalledWith(
      `${window.location.origin}/online-check.txt`,
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    )
  })

  it('does not probe again when StrictMode remounts the provider', async () => {
    const { unmount } = render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

    unmount()
    render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  })

  it('dedupes concurrent connectivity checks', async () => {
    let resolveFetch: ((value: Response) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve
          }),
      ),
    )

    render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    window.dispatchEvent(new Event('online'))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    resolveFetch?.({ ok: true } as Response)
  })
})
