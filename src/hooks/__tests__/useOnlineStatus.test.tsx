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

  it('marks offline immediately on the browser offline event', async () => {
    const { getByTestId } = render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new Event('offline'))

    await waitFor(() => expect(getByTestId('online').textContent).toBe('false'))
  })

  it('marks offline when the probe fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    const { getByTestId } = render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    await waitFor(() => expect(getByTestId('online').textContent).toBe('false'))
  })

  it('skips the probe when navigator reports offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    })

    const { getByTestId } = render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    await waitFor(() => expect(getByTestId('online').textContent).toBe('false'))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('marks offline when the probe returns a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const { getByTestId } = render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    await waitFor(() => expect(getByTestId('online').textContent).toBe('false'))
  })

  it('marks online immediately on browser online event then re-probes', async () => {
    const { getByTestId } = render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new Event('offline'))
    await waitFor(() => expect(getByTestId('online').textContent).toBe('false'))

    window.dispatchEvent(new Event('online'))
    await waitFor(() => expect(getByTestId('online').textContent).toBe('true'))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  })

  it('re-probes on the 60s interval while online', async () => {
    vi.useFakeTimers()
    render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('clears --offline-banner-inset on provider unmount', async () => {
    const { unmount } = render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    document.documentElement.style.setProperty('--offline-banner-inset', '1rem')
    unmount()
    expect(document.documentElement.style.getPropertyValue('--offline-banner-inset')).toBe('')
  })

  it('does not notify listeners when status is unchanged', async () => {
    const { getByTestId } = render(
      <OnlineStatusProvider>
        <ProbeConsumer />
      </OnlineStatusProvider>,
    )

    await waitFor(() => expect(getByTestId('online').textContent).toBe('true'))
    window.dispatchEvent(new Event('online'))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(getByTestId('online').textContent).toBe('true')
  })
})
