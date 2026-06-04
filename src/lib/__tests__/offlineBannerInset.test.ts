// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  getOfflineBannerInsetPx,
  setOfflineBannerInsetOnDocument,
  OFFLINE_BANNER_HEIGHT_REM,
} from '../offlineBannerInset'

describe('offlineBannerInset', () => {
  beforeEach(() => {
    document.documentElement.style.fontSize = '16px'
  })

  afterEach(() => {
    document.documentElement.style.removeProperty('--offline-banner-inset')
    document.documentElement.style.removeProperty('font-size')
  })

  it('returns 0 when online', () => {
    setOfflineBannerInsetOnDocument(true)
    expect(getOfflineBannerInsetPx()).toBe(0)
  })

  it('returns rem-based pixel height when offline', () => {
    setOfflineBannerInsetOnDocument(false)
    expect(getOfflineBannerInsetPx()).toBe(OFFLINE_BANNER_HEIGHT_REM * 16)
  })
})
