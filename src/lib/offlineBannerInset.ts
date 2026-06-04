/** Tailwind `h-11` / `top-11` — keep in sync with OfflineBanner. */
export const OFFLINE_BANNER_HEIGHT_REM = 2.75

const OFFLINE_BANNER_INSET_VAR = '--offline-banner-inset'

export function setOfflineBannerInsetOnDocument(isOnline: boolean): void {
  const root = document.documentElement
  if (isOnline) {
    root.style.setProperty(OFFLINE_BANNER_INSET_VAR, '0px')
  } else {
    root.style.setProperty(OFFLINE_BANNER_INSET_VAR, `${OFFLINE_BANNER_HEIGHT_REM}rem`)
  }
}

/** Pixel height reserved for the fixed offline banner (0 when online). */
export function getOfflineBannerInsetPx(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(OFFLINE_BANNER_INSET_VAR)
    .trim()

  if (!raw || raw === '0' || raw === '0px') return 0

  if (raw.endsWith('rem')) {
    const rem = Number.parseFloat(raw)
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    return rem * (Number.isFinite(rootFontSize) ? rootFontSize : 16)
  }

  if (raw.endsWith('px')) {
    return Number.parseFloat(raw)
  }

  return OFFLINE_BANNER_HEIGHT_REM * 16
}
