import type { PushNotificationPayload } from "./push";

export type PushSuppressionChecker = (payload: PushNotificationPayload) => boolean;

let activeChecker: PushSuppressionChecker | null = null;

export function setPushSuppressionChecker(checker: PushSuppressionChecker | null): void {
  activeChecker = checker;
}

export function shouldSuppressPushNotification(payload: PushNotificationPayload): boolean {
  return activeChecker?.(payload) ?? false;
}

export function resetPushSuppressionForTests(): void {
  activeChecker = null;
}
