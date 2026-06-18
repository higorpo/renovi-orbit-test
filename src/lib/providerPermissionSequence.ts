/**
 * Serializes provider onboarding prompts: location explainer/OS first, then push.
 * Clients skip the location phase (flow never starts).
 */

let flowStarted = false
let flowComplete = false
const waiters = new Set<() => void>()

export function resetProviderPermissionSequence(): void {
  flowStarted = false
  flowComplete = false
  for (const resolve of waiters) {
    resolve()
  }
  waiters.clear()
}

export function markProviderLocationPermissionFlowStarted(): void {
  flowStarted = true
}

export function markProviderLocationPermissionFlowComplete(): void {
  if (flowComplete) return
  flowComplete = true
  for (const resolve of waiters) {
    resolve()
  }
  waiters.clear()
}

export function isProviderLocationPermissionFlowComplete(): boolean {
  return flowComplete
}

export async function waitForProviderLocationPermissionFlow(): Promise<void> {
  if (flowComplete || !flowStarted) {
    return
  }

  await new Promise<void>((resolve) => {
    waiters.add(resolve)
  })
}
