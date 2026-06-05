type StopListener = () => void;

const listeners = new Map<string, StopListener>();
let activeOwnerId: string | null = null;

export function registerChatAudioPlaybackOwner(
  ownerId: string,
  onStop: StopListener,
): () => void {
  listeners.set(ownerId, onStop);
  return () => {
    listeners.delete(ownerId);
    if (activeOwnerId === ownerId) {
      activeOwnerId = null;
    }
  };
}

export function claimChatAudioPlayback(ownerId: string): void {
  if (activeOwnerId === ownerId) return;

  if (activeOwnerId !== null) {
    listeners.get(activeOwnerId)?.();
  }

  activeOwnerId = ownerId;
}

export function releaseChatAudioPlayback(ownerId: string): void {
  if (activeOwnerId === ownerId) {
    activeOwnerId = null;
  }
}

/** Resets module singleton between unit tests. */
export function resetChatAudioPlaybackCoordinator(): void {
  if (activeOwnerId !== null) {
    listeners.get(activeOwnerId)?.();
  }
  activeOwnerId = null;
  listeners.clear();
}
