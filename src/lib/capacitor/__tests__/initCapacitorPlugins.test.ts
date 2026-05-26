// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
}))

const systemBarsMocks = vi.hoisted(() => ({
  setStyle: vi.fn(),
}))

const appMocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  exitApp: vi.fn(),
}))

const keyboardMocks = vi.hoisted(() => ({
  addListener: vi.fn(),
}))

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitorMocks,
  SystemBars: systemBarsMocks,
  SystemBarsStyle: { Light: 'LIGHT', Dark: 'DARK', Default: 'DEFAULT' },
}))

vi.mock('@capacitor/app', () => ({
  App: appMocks,
}))

vi.mock('@capacitor/keyboard', () => ({
  Keyboard: keyboardMocks,
}))

vi.mock('@/lib/logger', () => ({
  logger: loggerMocks,
}))

import {
  applyNativeSystemBarsStyle,
  initCapacitorPlugins,
} from '../initCapacitorPlugins'

type ListenerMap = {
  backButton?: (payload: { canGoBack: boolean }) => void
  appStateChange?: (payload: { isActive: boolean }) => void
  keyboardWillShow?: (payload: { keyboardHeight: number }) => void
  keyboardWillHide?: () => void
}

function captureListeners(): ListenerMap {
  const map: ListenerMap = {}
  appMocks.addListener.mockImplementation((event: string, cb: ListenerMap[keyof ListenerMap]) => {
    if (event === 'backButton') map.backButton = cb as ListenerMap['backButton']
    if (event === 'appStateChange') map.appStateChange = cb as ListenerMap['appStateChange']
    return Promise.resolve({ remove: vi.fn() })
  })
  keyboardMocks.addListener.mockImplementation((event: string, cb: ListenerMap[keyof ListenerMap]) => {
    if (event === 'keyboardWillShow') map.keyboardWillShow = cb as ListenerMap['keyboardWillShow']
    if (event === 'keyboardWillHide') map.keyboardWillHide = cb as ListenerMap['keyboardWillHide']
    return Promise.resolve({ remove: vi.fn() })
  })
  return map
}

describe('applyNativeSystemBarsStyle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    systemBarsMocks.setStyle.mockResolvedValue(undefined)
    capacitorMocks.isNativePlatform.mockReturnValue(false)
  })

  it('no-ops on web', async () => {
    await applyNativeSystemBarsStyle()
    expect(systemBarsMocks.setStyle).not.toHaveBeenCalled()
  })

  it('sets light style on native', async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true)
    await applyNativeSystemBarsStyle()
    expect(systemBarsMocks.setStyle).toHaveBeenCalledWith({ style: 'LIGHT' })
  })

  it('logs warn when setStyle throws Error', async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true)
    systemBarsMocks.setStyle.mockRejectedValueOnce(new Error('style failed'))
    await applyNativeSystemBarsStyle()
    expect(loggerMocks.warn).toHaveBeenCalledWith('capacitor_system_bars_style_failed', {
      message: 'style failed',
    })
  })

  it('stringifies non-Error rejections', async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true)
    systemBarsMocks.setStyle.mockRejectedValueOnce(42)
    await applyNativeSystemBarsStyle()
    expect(loggerMocks.warn).toHaveBeenCalledWith('capacitor_system_bars_style_failed', {
      message: '42',
    })
  })
})

describe('initCapacitorPlugins', () => {
  const historyBack = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    capacitorMocks.isNativePlatform.mockReturnValue(false)
    capacitorMocks.getPlatform.mockReturnValue('web')
    systemBarsMocks.setStyle.mockResolvedValue(undefined)
    appMocks.exitApp.mockResolvedValue(undefined)
    historyBack.mockReset()
    vi.stubGlobal('history', { ...window.history, back: historyBack })
    document.documentElement.style.removeProperty('--keyboard-height')
    delete document.documentElement.dataset.appActive
    captureListeners()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers keyboard and app lifecycle listeners on web', async () => {
    await initCapacitorPlugins()
    expect(keyboardMocks.addListener).toHaveBeenCalledWith('keyboardWillShow', expect.any(Function))
    expect(keyboardMocks.addListener).toHaveBeenCalledWith('keyboardWillHide', expect.any(Function))
    expect(appMocks.addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function))
    expect(systemBarsMocks.setStyle).not.toHaveBeenCalled()
    expect(appMocks.addListener).not.toHaveBeenCalledWith('backButton', expect.any(Function))
  })

  it('updates keyboard height CSS variable when keyboard shows', async () => {
    const listeners = captureListeners()
    await initCapacitorPlugins()
    listeners.keyboardWillShow?.({ keyboardHeight: 280 })
    expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('280px')
  })

  it('removes keyboard height when keyboard hides', async () => {
    const listeners = captureListeners()
    await initCapacitorPlugins()
    listeners.keyboardWillShow?.({ keyboardHeight: 100 })
    listeners.keyboardWillHide?.()
    expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('')
  })

  it('sets appActive dataset from app state changes', async () => {
    const listeners = captureListeners()
    await initCapacitorPlugins()
    listeners.appStateChange?.({ isActive: true })
    expect(document.documentElement.dataset.appActive).toBe('true')
    listeners.appStateChange?.({ isActive: false })
    expect(document.documentElement.dataset.appActive).toBe('false')
  })

  it('applies system bars and android back button on native android', async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true)
    capacitorMocks.getPlatform.mockReturnValue('android')
    const listeners = captureListeners()
    await initCapacitorPlugins()
    expect(systemBarsMocks.setStyle).toHaveBeenCalledWith({ style: 'LIGHT' })
    expect(appMocks.addListener).toHaveBeenCalledWith('backButton', expect.any(Function))

    listeners.backButton?.({ canGoBack: true })
    expect(historyBack).toHaveBeenCalledTimes(1)
    expect(appMocks.exitApp).not.toHaveBeenCalled()

    listeners.backButton?.({ canGoBack: false })
    expect(appMocks.exitApp).toHaveBeenCalledTimes(1)
  })

  it('does not register back button on native ios', async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true)
    capacitorMocks.getPlatform.mockReturnValue('ios')
    await initCapacitorPlugins()
    expect(appMocks.addListener).not.toHaveBeenCalledWith('backButton', expect.any(Function))
  })
})
