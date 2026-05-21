/** Web prefix used by @capacitor/preferences (must match app). */
export const PREFERENCES_WEB_KEY_PREFIX = 'CapacitorStorage.'

export function toCapacitorPreferencesWebKey(key: string): string {
  return `${PREFERENCES_WEB_KEY_PREFIX}${key}`
}
