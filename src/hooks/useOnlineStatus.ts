import {
  createContext,
  createElement,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { setOfflineBannerInsetOnDocument } from '@/lib/offlineBannerInset'

const CHECK_INTERVAL_MS = 60_000
const REQUEST_TIMEOUT_MS = 8_000

export { OFFLINE_BANNER_HEIGHT_REM } from '@/lib/offlineBannerInset'

const OnlineStatusContext = createContext<boolean>(true)

const getConnectivityCheckUrls = (): string[] => {
  const urls: string[] = []
  if (typeof window !== 'undefined' && window.location?.origin) {
    urls.push(`${window.location.origin}/online-check.txt`)
  }
  return urls
}

async function checkUrlReachable(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return true
  } catch {
    clearTimeout(timeoutId)
    return false
  }
}

function useOnlineStatusProbe(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true
  )
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const urlIndexRef = useRef(0)

  useEffect(() => {
    const urls = getConnectivityCheckUrls()
    if (urls.length === 0) return

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const runCheck = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false)
        return
      }
      const index = urlIndexRef.current % urls.length
      urlIndexRef.current += 1
      const url = urls[index]
      checkUrlReachable(url).then(setIsOnline)
    }

    runCheck()
    intervalRef.current = setInterval(runCheck, CHECK_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  return true
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
 * and periodically probes one URL per cycle (rotating through the list).
 * State is shared app-wide via OnlineStatusProvider (see RootLayout).
 */
export function useOnlineStatus(): boolean {
  return useContext(OnlineStatusContext)
}
