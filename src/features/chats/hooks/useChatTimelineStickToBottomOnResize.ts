import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { isNearChatBottom } from "../utils/chatTimelineScroll";

const LAST_TIMELINE_MESSAGE_SELECTOR = '[data-chat-timeline-last="true"]';
const SCROLL_UP_CLEAR_THRESHOLD_PX = 8;

interface UseChatTimelineStickToBottomOnResizeParams {
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Last timeline message row key; re-attaches the observer when it changes. */
  lastTimelineMessageKey: string | null;
  lastMessageId: string | undefined;
  /** Whether the timeline already performed its first scroll-to-bottom. */
  initialScrollDone: boolean;
  enabled: boolean;
  scrollToLatest: (behavior?: ScrollBehavior) => void;
}

/**
 * Re-scrolls to the latest message when the last row grows (e.g. proposal card hydration)
 * or when a new tail message is appended while the user is following the bottom.
 */
export function useChatTimelineStickToBottomOnResize({
  scrollRef,
  lastTimelineMessageKey,
  lastMessageId,
  initialScrollDone,
  enabled,
  scrollToLatest,
}: UseChatTimelineStickToBottomOnResizeParams) {
  const stickToBottomRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const prevLastMessageIdRef = useRef<string | undefined>(undefined);

  const markStickToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    const element = scrollRef.current;
    if (element) {
      lastScrollTopRef.current = element.scrollTop;
    }
  }, [scrollRef]);

  const clearStickToBottomIfScrolledUp = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollTop } = element;
    if (scrollTop < lastScrollTopRef.current - SCROLL_UP_CLEAR_THRESHOLD_PX) {
      stickToBottomRef.current = false;
    } else if (isNearChatBottom(element)) {
      stickToBottomRef.current = true;
    }
    lastScrollTopRef.current = scrollTop;
  }, [scrollRef]);

  const shouldFollowLatestMessages = useCallback(() => {
    if (stickToBottomRef.current) return true;
    const element = scrollRef.current;
    return element ? isNearChatBottom(element) : false;
  }, [scrollRef]);

  const runScrollToLatestBurst = useCallback(() => {
    scrollToLatest("auto");
    requestAnimationFrame(() => {
      scrollToLatest("auto");
      requestAnimationFrame(() => scrollToLatest("auto"));
    });
  }, [scrollToLatest]);

  useLayoutEffect(() => {
    if (!initialScrollDone || !lastMessageId) return;

    const prevId = prevLastMessageIdRef.current;
    const hadMessageChange = prevId !== undefined && prevId !== lastMessageId;
    prevLastMessageIdRef.current = lastMessageId;
    if (!hadMessageChange || !shouldFollowLatestMessages()) return;

    runScrollToLatestBurst();
  }, [initialScrollDone, lastMessageId, runScrollToLatestBurst, shouldFollowLatestMessages]);

  useEffect(() => {
    if (!enabled || !lastTimelineMessageKey) return;

    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const lastRow = scrollEl.querySelector<HTMLElement>(LAST_TIMELINE_MESSAGE_SELECTOR);
    if (!lastRow) return;

    const observer = new ResizeObserver(() => {
      if (!stickToBottomRef.current) return;
      runScrollToLatestBurst();
    });

    observer.observe(lastRow);
    return () => observer.disconnect();
  }, [enabled, lastTimelineMessageKey, runScrollToLatestBurst, scrollRef]);

  return { markStickToBottom, clearStickToBottomIfScrolledUp };
}
