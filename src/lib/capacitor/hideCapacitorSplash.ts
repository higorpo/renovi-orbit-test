import { SplashScreen } from '@capacitor/splash-screen'
import { logger } from '@/lib/logger'

let hidePromise: Promise<void> | null = null

/** Resets module state between unit tests. */
export function resetHideCapacitorSplashForTests(): void {
  hidePromise = null
}

/** Hides the native/PWA splash once; safe to call multiple times. */
export function hideCapacitorSplash(): Promise<void> {
  if (!hidePromise) {
    hidePromise = SplashScreen.hide().catch((error: unknown) => {
      hidePromise = null
      logger.warn('capacitor_splash_hide_failed', {
        message: error instanceof Error ? error.message : String(error),
      })
    })
  }
  return hidePromise
}
