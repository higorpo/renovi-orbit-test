import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useVirtualKeyboardVisible } from "@/hooks/useVirtualKeyboardVisible";
import {
  CHAT_KEYBOARD_SCROLL_SNAP_DELAYS_MS,
  isNearChatBottom,
} from "../utils/chatTimelineScroll";

export interface UseSnapChatTimelineOnKeyboardOpenParams {
  scrollRef: RefObject<HTMLDivElement | null>;
  scrollToLatest: () => void;
  enabled: boolean;
}

/**
 * When the mobile keyboard opens, snaps back to the latest message if the user
 * was already at (or near) the bottom before the keyboard appeared.
 */
export function useSnapChatTimelineOnKeyboardOpen({
  scrollRef,
  scrollToLatest,
  enabled,
}: UseSnapChatTimelineOnKeyboardOpenParams) {
  const isKeyboardVisible = useVirtualKeyboardVisible();
  const wasKeyboardVisibleRef = useRef(false);
  const anchoredNearBottomRef = useRef(true);

  const readNearBottom = useCallback(() => {
    const element = scrollRef.current;
    return element ? isNearChatBottom(element) : false;
  }, [scrollRef]);

  const anchorBeforeKeyboard = useCallback(() => {
    anchoredNearBottomRef.current = readNearBottom();
  }, [readNearBottom]);

  const syncNearBottomFromScroll = useCallback(() => {
    anchoredNearBottomRef.current = readNearBottom();
  }, [readNearBottom]);

  useEffect(() => {
    if (!enabled) return;

    const wasVisible = wasKeyboardVisibleRef.current;
    wasKeyboardVisibleRef.current = isKeyboardVisible;

    if (!isKeyboardVisible || wasVisible) return;
    if (!anchoredNearBottomRef.current) return;

    const snap = () => scrollToLatest();
    snap();

    const timeoutIds = CHAT_KEYBOARD_SCROLL_SNAP_DELAYS_MS.map((delayMs) =>
      window.setTimeout(snap, delayMs),
    );

    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, [enabled, isKeyboardVisible, scrollToLatest]);

  return { anchorBeforeKeyboard, syncNearBottomFromScroll };
}
