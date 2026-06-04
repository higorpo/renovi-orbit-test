import { App } from '@capacitor/app'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { logger } from '@/lib/logger'
import { closeTopOverlay } from '@/lib/overlayHistory'

/** Light status/navigation bar content (dark icons) for the light app chrome. */
export async function applyNativeSystemBarsStyle(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    await SystemBars.setStyle({ style: SystemBarsStyle.Light })
  } catch (error) {
    logger.warn('capacitor_system_bars_style_failed', {
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function registerAndroidBackButton(): void {
  if (Capacitor.getPlatform() !== 'android') return

  void App.addListener('backButton', ({ canGoBack }) => {
    if (closeTopOverlay()) return

    if (canGoBack) {
      window.history.back()
      return
    }
    void App.exitApp()
  })
}

function registerKeyboardInsets(): void {
  void Keyboard.addListener('keyboardWillShow', (info) => {
    document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`)
  })

  void Keyboard.addListener('keyboardWillHide', () => {
    document.documentElement.style.removeProperty('--keyboard-height')
  })
}

function registerAppLifecycle(): void {
  void App.addListener('appStateChange', ({ isActive }) => {
    document.documentElement.dataset.appActive = isActive ? 'true' : 'false'
  })
}

/**
 * Initializes Capacitor plugins (SystemBars, keyboard, app lifecycle).
 * Splash hide is deferred until routes mount — see CapacitorSplashHider in RootLayout.
 */
export async function initCapacitorPlugins(): Promise<void> {
  registerKeyboardInsets()
  registerAppLifecycle()

  if (Capacitor.isNativePlatform()) {
    await applyNativeSystemBarsStyle()
    registerAndroidBackButton()
  }
}
