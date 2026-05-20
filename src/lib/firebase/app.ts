import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'

import { getFirebaseClientConfig } from './config'

let firebaseApp: FirebaseApp | null = null

export function getFirebaseApp(): FirebaseApp | null {
  const config = getFirebaseClientConfig()
  if (!config) return null

  if (!firebaseApp) {
    firebaseApp = getApps().length > 0 ? getApps()[0]! : initializeApp(config)
  }

  return firebaseApp
}

/** Clears cached app instance between unit tests. */
export function resetFirebaseAppForTests(): void {
  firebaseApp = null
}
