import { beforeEach, describe, expect, it } from 'vitest'

import {
  markProviderLocationPermissionFlowComplete,
  markProviderLocationPermissionFlowStarted,
  markPushPermissionPromptFlowComplete,
  markPushPermissionPromptFlowStarted,
  resetAppOpenOverlaySequence,
  waitForProviderLocationPermissionFlow,
  waitForPushPermissionPromptFlow,
} from '../appOpenOverlaySequence'

describe('appOpenOverlaySequence', () => {
  beforeEach(() => {
    resetAppOpenOverlaySequence()
  })

  it('does not block when the location flow never started', async () => {
    await expect(waitForProviderLocationPermissionFlow()).resolves.toBeUndefined()
  })

  it('blocks until the provider location flow completes', async () => {
    markProviderLocationPermissionFlowStarted()

    let settled = false
    const pending = waitForProviderLocationPermissionFlow().then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    markProviderLocationPermissionFlowComplete()
    await pending
    expect(settled).toBe(true)
  })

  it('resolves immediately when the location flow already completed', async () => {
    markProviderLocationPermissionFlowStarted()
    markProviderLocationPermissionFlowComplete()

    await expect(waitForProviderLocationPermissionFlow()).resolves.toBeUndefined()
  })

  it('does not block when the push flow never started', async () => {
    await expect(waitForPushPermissionPromptFlow()).resolves.toBeUndefined()
  })

  it('blocks until the push permission flow completes', async () => {
    markPushPermissionPromptFlowStarted()

    let settled = false
    const pending = waitForPushPermissionPromptFlow().then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    markPushPermissionPromptFlowComplete()
    await pending
    expect(settled).toBe(true)
  })

  it('resolves immediately when the push flow already completed', async () => {
    markPushPermissionPromptFlowStarted()
    markPushPermissionPromptFlowComplete()

    await expect(waitForPushPermissionPromptFlow()).resolves.toBeUndefined()
  })

  it('reset releases both location and push waiters', async () => {
    markProviderLocationPermissionFlowStarted()
    markPushPermissionPromptFlowStarted()

    let locationSettled = false
    let pushSettled = false
    const locationPending = waitForProviderLocationPermissionFlow().then(() => {
      locationSettled = true
    })
    const pushPending = waitForPushPermissionPromptFlow().then(() => {
      pushSettled = true
    })

    await Promise.resolve()
    expect(locationSettled).toBe(false)
    expect(pushSettled).toBe(false)

    resetAppOpenOverlaySequence()
    await Promise.all([locationPending, pushPending])
    expect(locationSettled).toBe(true)
    expect(pushSettled).toBe(true)
  })
})
