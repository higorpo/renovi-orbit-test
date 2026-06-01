const RECENT_SENT_TTL_MS = 15_000;

const recentlySentMessageIds = new Map<string, number>();

function pruneExpired(now: number): void {
  for (const [id, expiresAt] of recentlySentMessageIds) {
    if (expiresAt <= now) recentlySentMessageIds.delete(id);
  }
}

/** Skip redundant list_chat_messages invalidation when Realtime echoes our own INSERT. */
export function rememberSentChatMessageId(messageId: string): void {
  const now = Date.now();
  pruneExpired(now);
  recentlySentMessageIds.set(messageId, now + RECENT_SENT_TTL_MS);
}

export function wasRecentlySentChatMessageId(messageId: string): boolean {
  const now = Date.now();
  const expiresAt = recentlySentMessageIds.get(messageId);
  if (expiresAt == null) return false;
  if (expiresAt <= now) {
    recentlySentMessageIds.delete(messageId);
    return false;
  }
  return true;
}
