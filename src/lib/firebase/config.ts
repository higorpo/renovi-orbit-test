export interface FirebaseClientConfig {
  apiKey: string
  authDomain: string
  projectId: string
  messagingSenderId: string
  appId: string
}

export function getFirebaseClientConfig(): FirebaseClientConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
    | string
    | undefined
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined

  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    return null
  }

  return { apiKey, authDomain, projectId, messagingSenderId, appId }
}

export function getFirebaseVapidKey(): string | null {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined
  return vapidKey?.trim() ? vapidKey.trim() : null
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseClientConfig() !== null && getFirebaseVapidKey() !== null
}
