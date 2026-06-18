import { beforeEach, describe, expect, it } from 'vitest'

import {
  markProviderLocationPermissionFlowComplete,
  markProviderLocationPermissionFlowStarted,
  resetProviderPermissionSequence,
  waitForProviderLocationPermissionFlow,
} from '../providerPermissionSequence'

describe('providerPermissionSequence', () => {
  beforeEach(() => {
    resetProviderPermissionSequence()
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

  it('resolves immediately when the flow already completed', async () => {
    markProviderLocationPermissionFlowStarted()
    markProviderLocationPermissionFlowComplete()

    await expect(waitForProviderLocationPermissionFlow()).resolves.toBeUndefined()
  })
})
