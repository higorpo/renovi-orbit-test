import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

type OverlayCloseFn = () => void

const overlayStack: OverlayCloseFn[] = []
const overlayListeners = new Set<() => void>()

function notifyOverlayListeners(): void {
  overlayListeners.forEach((listener) => listener())
}

function getOverlayCount(): number {
  return overlayStack.length
}

export function subscribeOverlayStack(listener: () => void): () => void {
  overlayListeners.add(listener)
  return () => overlayListeners.delete(listener)
}

export function getOverlayStackSnapshot(): number {
  return getOverlayCount()
}

/** Used by native back handling to close overlays before route navigation. */
export function hasOpenOverlay(): boolean {
  return getOverlayCount() > 0
}

export function registerOverlayClose(onClose: () => void): () => void {
  let released = false

  const release = () => {
    if (released) return
    released = true
    const index = overlayStack.indexOf(requestClose)
    if (index >= 0) overlayStack.splice(index, 1)
    notifyOverlayListeners()
  }

  const requestClose = () => {
    release()
    onClose()
  }

  overlayStack.push(requestClose)
  notifyOverlayListeners()
  return release
}

export function closeTopOverlay(): boolean {
  const top = overlayStack[overlayStack.length - 1]
  if (!top) return false
  top()
  return true
}

/**
 * Tracks open overlays so back closes them before SPA navigation.
 * Does not touch the history stack (avoids fighting React Router).
 */
export function useOverlayOpenChange(
  open: boolean | undefined,
  onOpenChange?: (open: boolean) => void
): (open: boolean) => void {
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const releaseRef = useRef<(() => void) | null>(null)

  const release = useCallback(() => {
    releaseRef.current?.()
    releaseRef.current = null
  }, [])

  const register = useCallback(() => {
    if (releaseRef.current) return

    releaseRef.current = registerOverlayClose(() => {
      onOpenChangeRef.current?.(false)
    })
  }, [])

  useEffect(() => {
    if (open === undefined) return

    if (open) register()
    else release()

    return release
  }, [open, register, release])

  return useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) register()
      else release()
      onOpenChangeRef.current?.(nextOpen)
    },
    [register, release]
  )
}

export function useHasOpenOverlay(): boolean {
  return useSyncExternalStore(
    subscribeOverlayStack,
    getOverlayStackSnapshot,
    () => 0
  ) > 0
}
