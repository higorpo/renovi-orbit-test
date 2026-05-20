import type { FirebaseApp } from 'firebase/app'
import { getMessaging } from 'firebase/messaging'

let messagingInstance: ReturnType<typeof getMessaging> | null = null

export function getFirebaseMessaging(app: FirebaseApp) {
  if (!messagingInstance) {
    messagingInstance = getMessaging(app)
  }
  return messagingInstance
}

/** Clears cached messaging instance between unit tests. */
export function resetFirebaseMessagingForTests(): void {
  messagingInstance = null
}
