/** Distance from scroll bottom treated as "at latest messages" for keyboard snap-back. */
export const CHAT_NEAR_BOTTOM_THRESHOLD_PX = 120;

export function getChatDistanceFromBottom(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

export function isNearChatBottom(
  element: HTMLElement,
  thresholdPx = CHAT_NEAR_BOTTOM_THRESHOLD_PX,
): boolean {
  return getChatDistanceFromBottom(element) <= thresholdPx;
}

/** Delays (ms) to re-run scroll after the virtual keyboard finishes opening. */
export const CHAT_KEYBOARD_SCROLL_SNAP_DELAYS_MS = [50, 150, 320, 450] as const;
