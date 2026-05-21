import { beforeEach, describe, expect, it, vi } from 'vitest'

const splashMocks = vi.hoisted(() => ({
  hide: vi.fn(),
}))

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
}))

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: splashMocks,
}))

vi.mock('@/lib/logger', () => ({
  logger: loggerMocks,
}))

import {
  hideCapacitorSplash,
  resetHideCapacitorSplashForTests,
} from '../hideCapacitorSplash'

describe('hideCapacitorSplash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetHideCapacitorSplashForTests()
    splashMocks.hide.mockResolvedValue(undefined)
  })

  it('calls SplashScreen.hide on first invocation', async () => {
    await hideCapacitorSplash()
    expect(splashMocks.hide).toHaveBeenCalledTimes(1)
  })

  it('reuses the same promise on concurrent calls', async () => {
    const first = hideCapacitorSplash()
    const second = hideCapacitorSplash()
    expect(first).toBe(second)
    await first
    expect(splashMocks.hide).toHaveBeenCalledTimes(1)
  })

  it('logs warn and allows retry when hide fails with Error', async () => {
    splashMocks.hide.mockRejectedValueOnce(new Error('hide failed'))
    await hideCapacitorSplash()
    expect(loggerMocks.warn).toHaveBeenCalledWith('capacitor_splash_hide_failed', {
      message: 'hide failed',
    })

    resetHideCapacitorSplashForTests()
    splashMocks.hide.mockResolvedValueOnce(undefined)
    await hideCapacitorSplash()
    expect(splashMocks.hide).toHaveBeenCalledTimes(2)
  })

  it('stringifies non-Error rejections in warn payload', async () => {
    splashMocks.hide.mockRejectedValueOnce('network down')
    await hideCapacitorSplash()
    expect(loggerMocks.warn).toHaveBeenCalledWith('capacitor_splash_hide_failed', {
      message: 'network down',
    })
  })
})
