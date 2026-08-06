/**
 * Serializes soft overlays on app open (client and provider):
 * 1) provider location explainer/OS (clients skip — flow never starts)
 * 2) soft push permission prompt
 * 3) pending evaluation prompt (awaits both waiters above)
 */

let locationFlowStarted = false
let locationFlowComplete = false
const locationWaiters = new Set<() => void>()

let pushFlowStarted = false
let pushFlowComplete = false
const pushWaiters = new Set<() => void>()

export function resetAppOpenOverlaySequence(): void {
  locationFlowStarted = false
  locationFlowComplete = false
  for (const resolve of locationWaiters) {
    resolve()
  }
  locationWaiters.clear()

  pushFlowStarted = false
  pushFlowComplete = false
  for (const resolve of pushWaiters) {
    resolve()
  }
  pushWaiters.clear()
}

export function markProviderLocationPermissionFlowStarted(): void {
  locationFlowStarted = true
}

export function markProviderLocationPermissionFlowComplete(): void {
  if (locationFlowComplete) return
  locationFlowComplete = true
  for (const resolve of locationWaiters) {
    resolve()
  }
  locationWaiters.clear()
}

export function isProviderLocationPermissionFlowComplete(): boolean {
  return locationFlowComplete
}

export async function waitForProviderLocationPermissionFlow(): Promise<void> {
  if (locationFlowComplete || !locationFlowStarted) {
    return
  }

  await new Promise<void>((resolve) => {
    locationWaiters.add(resolve)
  })
}

export function markPushPermissionPromptFlowStarted(): void {
  pushFlowStarted = true
}

export function markPushPermissionPromptFlowComplete(): void {
  if (pushFlowComplete) return
  pushFlowComplete = true
  for (const resolve of pushWaiters) {
    resolve()
  }
  pushWaiters.clear()
}

export function isPushPermissionPromptFlowComplete(): boolean {
  return pushFlowComplete
}

export async function waitForPushPermissionPromptFlow(): Promise<void> {
  if (pushFlowComplete || !pushFlowStarted) {
    return
  }

  await new Promise<void>((resolve) => {
    pushWaiters.add(resolve)
  })
}
