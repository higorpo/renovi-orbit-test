import {
  createContext,
  createElement,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { setOfflineBannerInsetOnDocument } from '@/lib/offlineBannerInset'

const CHECK_INTERVAL_MS = 60_000
const REQUEST_TIMEOUT_MS = 8_000

export { OFFLINE_BANNER_HEIGHT_REM } from '@/lib/offlineBannerInset'

const OnlineStatusContext = createContext<boolean>(true)

const getConnectivityCheckUrl = (): string | null => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return null
  }
  return `${window.location.origin}/online-check.txt`
}

async function checkUrlReachable(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    clearTimeout(timeoutId)
    return false
  }
}

type OnlineStatusListener = (isOnline: boolean) => void

const probeState = {
  started: false,
  isOnline: typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true,
  listeners: new Set<OnlineStatusListener>(),
  intervalId: null as ReturnType<typeof setInterval> | null,
  checkInFlight: false,
}

function notifyOnlineStatusListeners(isOnline: boolean): void {
  if (probeState.isOnline === isOnline) {
    return
  }
  probeState.isOnline = isOnline
  for (const listener of probeState.listeners) {
    listener(isOnline)
  }
}

async function runConnectivityCheck(): Promise<void> {
  if (probeState.checkInFlight) {
    return
  }

  const url = getConnectivityCheckUrl()
  if (!url) {
    return
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifyOnlineStatusListeners(false)
    return
  }

  probeState.checkInFlight = true
  try {
    const reachable = await checkUrlReachable(url)
    notifyOnlineStatusListeners(reachable)
  } finally {
    probeState.checkInFlight = false
  }
}

function handleBrowserOnline(): void {
  notifyOnlineStatusListeners(true)
  void runConnectivityCheck()
}

function handleBrowserOffline(): void {
  notifyOnlineStatusListeners(false)
}

function startConnectivityProbeOnce(): void {
  if (probeState.started || typeof window === 'undefined') {
    return
  }
  probeState.started = true

  window.addEventListener('online', handleBrowserOnline)
  window.addEventListener('offline', handleBrowserOffline)

  void runConnectivityCheck()
  probeState.intervalId = setInterval(() => {
    void runConnectivityCheck()
  }, CHECK_INTERVAL_MS)
}

function subscribeOnlineStatus(listener: OnlineStatusListener): () => void {
  startConnectivityProbeOnce()
  probeState.listeners.add(listener)
  listener(probeState.isOnline)
  return () => {
    probeState.listeners.delete(listener)
  }
}

/** @internal test helper */
export function __resetOnlineStatusProbeForTests(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleBrowserOnline)
    window.removeEventListener('offline', handleBrowserOffline)
  }
  if (probeState.intervalId) {
    clearInterval(probeState.intervalId)
  }
  probeState.started = false
  probeState.isOnline = true
  probeState.listeners.clear()
  probeState.intervalId = null
  probeState.checkInFlight = false
}

function useOnlineStatusProbe(): boolean {
  const [isOnline, setIsOnline] = useState(probeState.isOnline)

  useEffect(() => subscribeOnlineStatus(setIsOnline), [])

  return isOnline
}

export function OnlineStatusProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatusProbe()

  useEffect(() => {
    setOfflineBannerInsetOnDocument(isOnline)
    return () => {
      document.documentElement.style.removeProperty('--offline-banner-inset')
    }
  }, [isOnline])

  return createElement(OnlineStatusContext.Provider, { value: isOnline }, children)
}

/**
 * Returns whether the app has internet connectivity.
 * Uses navigator.onLine + window online/offline events for immediate updates,
 * and periodically probes `/online-check.txt` (network-only via service worker).
 * State is shared app-wide via OnlineStatusProvider (see RootLayout).
 */
export function useOnlineStatus(): boolean {
  return useContext(OnlineStatusContext)
}
