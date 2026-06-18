import {
  preferencesGet,
  preferencesRemove,
  preferencesSet,
} from '@/lib/capacitor/preferencesStorage'

/** Persisted once per device install after the explainer is shown or answered. */
export const LOCATION_PERMISSION_DIALOG_KEY = 'orbit.location_prompt_seen'

/** Cached OS permission outcome for beacon sync (Task 66 reads this). */
export const LOCATION_PERMISSION_GRANTED_KEY = 'orbit.location_permission_granted'

export async function isLocationPromptSeen(): Promise<boolean> {
  try {
    const raw = await preferencesGet(LOCATION_PERMISSION_DIALOG_KEY)
    return raw === 'true'
  } catch {
    return false
  }
}

export async function markLocationPromptSeen(): Promise<void> {
  await preferencesSet(LOCATION_PERMISSION_DIALOG_KEY, 'true')
}

export async function clearLocationPromptSeen(): Promise<void> {
  await preferencesRemove(LOCATION_PERMISSION_DIALOG_KEY)
}

export async function getStoredLocationPermissionGranted(): Promise<boolean | null> {
  try {
    const raw = await preferencesGet(LOCATION_PERMISSION_GRANTED_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
    return null
  } catch {
    return null
  }
}

export async function setStoredLocationPermissionGranted(granted: boolean): Promise<void> {
  await preferencesSet(LOCATION_PERMISSION_GRANTED_KEY, granted ? 'true' : 'false')
}

export async function clearStoredLocationPermissionGranted(): Promise<void> {
  await preferencesRemove(LOCATION_PERMISSION_GRANTED_KEY)
}
