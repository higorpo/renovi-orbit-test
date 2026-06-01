/** Design §5.4 — typing presence on `conversation:{id}:presence`. */
export const TYPING_PRESENCE_PUBLISH_INTERVAL_MS = 2_000;
export const TYPING_PRESENCE_TTL_MS = 10_000;
/** No field changes for this long → publish typing:false. */
export const TYPING_ACTIVITY_IDLE_MS = 2_000;

export type TypingPresencePayload = {
  user_id: string;
  typing: boolean;
  /** Bumped on each track so Realtime propagates a presence diff. */
  at: number;
};

export function conversationPresenceChannelName(conversationId: string): string {
  return `conversation:${conversationId}:presence`;
}

export function canPublishTypingPresence(
  now: number,
  lastPublishAt: number | null,
  options?: { bypassInterval?: boolean },
): boolean {
  if (options?.bypassInterval) return true;
  if (lastPublishAt === null) return true;
  return now - lastPublishAt >= TYPING_PRESENCE_PUBLISH_INTERVAL_MS;
}

/** Client-side expiry when remote stops sending typing:true (R27-AC04). */
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
  let latestRemote: { typing: boolean; at: number } | null = null;

  for (const [key, entries] of Object.entries(presenceState)) {
    for (const entry of entries) {
      const userId = entry?.user_id ?? key;
      if (userId === currentUserId) continue;

      const at = typeof entry?.at === "number" ? entry.at : 0;
      const typing = entry?.typing === true;
      if (!latestRemote || at >= latestRemote.at) {
        latestRemote = { typing, at };
      }
    }
  }

  return latestRemote?.typing ?? false;
}
