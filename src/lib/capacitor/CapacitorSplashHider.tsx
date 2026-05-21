import { useEffect } from 'react'
import { applyNativeSystemBarsStyle } from './initCapacitorPlugins'
import { hideCapacitorSplash } from './hideCapacitorSplash'

let splashUiHideStarted = false

/** Resets module state between unit tests. */
export function resetCapacitorSplashHiderForTests(): void {
  splashUiHideStarted = false
}

/** Hides the Capacitor splash after the router shell (and lazy route chunk) have mounted. */
export function CapacitorSplashHider() {
  useEffect(() => {
    if (splashUiHideStarted) return
    splashUiHideStarted = true
    void (async () => {
      await hideCapacitorSplash()
      await applyNativeSystemBarsStyle()
    })()
  }, [])

  return null
}
