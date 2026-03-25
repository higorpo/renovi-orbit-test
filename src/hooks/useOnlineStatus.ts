import { useState, useEffect, useRef } from 'react'

const CHECK_INTERVAL_MS = 30_000
const REQUEST_TIMEOUT_MS = 8_000

const getConnectivityCheckUrls = (): string[] => {
  const urls: string[] = []
  if (typeof window !== 'undefined' && window.location?.origin) {
    urls.push(window.location.origin)
  }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (supabaseUrl) {
    urls.push(supabaseUrl)
  }
  // urls.push('https://api.github.com')
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

/**
 * Returns whether the app has internet connectivity.
 * Uses navigator.onLine + window online/offline events for immediate updates,
 * and periodically probes one URL per cycle (rotating through the list).
 */
export function useOnlineStatus(): boolean {
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

  return isOnline
}
