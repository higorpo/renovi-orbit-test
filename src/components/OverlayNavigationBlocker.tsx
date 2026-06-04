import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import { closeTopOverlay, useHasOpenOverlay } from '@/lib/overlayHistory'

/**
 * Intercepts browser back (POP) while an overlay is open and closes it instead of changing routes.
 */
export function OverlayNavigationBlocker() {
  const hasOverlay = useHasOpenOverlay()

  const blocker = useBlocker(
    ({ historyAction }) => hasOverlay && historyAction === 'POP'
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    closeTopOverlay()
    blocker.reset()
  }, [blocker])

  return null
}
