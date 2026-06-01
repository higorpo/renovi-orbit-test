/** Design §5.4 — typing presence on `conversation:{id}:presence`. */
export const TYPING_PRESENCE_DEBOUNCE_MS = 500;
export const TYPING_PRESENCE_PUBLISH_INTERVAL_MS = 2_000;
export const TYPING_PRESENCE_TTL_MS = 10_000;

export type TypingPresencePayload = {
  user_id: string;
  typing: boolean;
};

export function conversationPresenceChannelName(conversationId: string): string {
  return `conversation:${conversationId}:presence`;
}

export function canPublishTypingPresence(now: number, lastPublishAt: number | null): boolean {
  if (lastPublishAt === null) return true;
  return now - lastPublishAt >= TYPING_PRESENCE_PUBLISH_INTERVAL_MS;
}

/** Client-side expiry when no presence heartbeat (R27-AC04). */
export function isRemoteTypingVisible(
  lastRemoteTypingAt: number | null,
  now: number,
  ttlMs: number = TYPING_PRESENCE_TTL_MS,
): boolean {
  if (lastRemoteTypingAt === null) return false;
  return now - lastRemoteTypingAt < ttlMs;
}

export function parseTypingPresenceState(
  presenceState: Record<string, TypingPresencePayload[]>,
  currentUserId: string,
): boolean {
  for (const [key, entries] of Object.entries(presenceState)) {
    for (const entry of entries) {
      const userId = entry?.user_id ?? key;
      if (userId === currentUserId) continue;
      if (entry?.typing === true) return true;
    }
  }
  return false;
}
