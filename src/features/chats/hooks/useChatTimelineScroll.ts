import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useChatTimelineStickToBottomOnResize } from "./useChatTimelineStickToBottomOnResize";
import { useSnapChatTimelineOnKeyboardOpen } from "./useSnapChatTimelineOnKeyboardOpen";

export interface UseChatTimelineScrollParams {
  resetKey?: string;
  isLoading: boolean;
  timelineItemCount: number;
  lastTimelineMessageKey: string | null;
  lastMessageId: string | undefined;
  actionBannerTopInset: number;
  snapOnKeyboardOpen: boolean;
}

export interface UseChatTimelineScrollResult {
  scrollRef: RefObject<HTMLDivElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  preserveScrollOnLayoutShift: () => void;
  onComposerFocus: () => void;
  /** Call from the timeline `onScroll` handler (stick-to-bottom + keyboard anchor). */
  onTimelineScroll: () => void;
}

export function useChatTimelineScroll({
  resetKey,
  isLoading,
  timelineItemCount,
  lastTimelineMessageKey,
  lastMessageId,
  actionBannerTopInset,
  snapOnKeyboardOpen,
}: UseChatTimelineScrollParams): UseChatTimelineScrollResult {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didInitialScrollRef = useRef(false);
  const [initialScrollDone, setInitialScrollDone] = useState(false);

  const scrollToLatest = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      bottomRef.current?.scrollIntoView({ block: "end", behavior });

      if (actionBannerTopInset <= 0) return;

      requestAnimationFrame(() => {
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;

        const lastMessage = scrollEl.querySelector<HTMLElement>('[data-chat-timeline-last="true"]');
        if (!lastMessage) return;

        const clearanceScrollTop = lastMessage.offsetTop - actionBannerTopInset;
        if (scrollEl.scrollTop < clearanceScrollTop) {
          scrollEl.scrollTop = Math.max(0, clearanceScrollTop);
        }
      });
    },
    [actionBannerTopInset],
  );

  const preserveScrollOnLayoutShift = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight - scrollRef.current.clientHeight - distanceFromBottom;
    });
  }, []);

  const { anchorBeforeKeyboard, syncNearBottomFromScroll } = useSnapChatTimelineOnKeyboardOpen({
    scrollRef,
    scrollToLatest: () => scrollToLatest("auto"),
    enabled: snapOnKeyboardOpen,
  });

  const { markStickToBottom, clearStickToBottomIfScrolledUp } =
    useChatTimelineStickToBottomOnResize({
      scrollRef,
      lastTimelineMessageKey,
      lastMessageId,
      initialScrollDone,
      enabled: !isLoading && timelineItemCount > 0,
      scrollToLatest,
    });

  useEffect(() => {
    didInitialScrollRef.current = false;
    setInitialScrollDone(false);
  }, [resetKey]);

  useEffect(() => {
    if (isLoading || timelineItemCount === 0 || didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    setInitialScrollDone(true);
    markStickToBottom();
    scrollToLatest("auto");
  }, [isLoading, markStickToBottom, scrollToLatest, timelineItemCount]);

  useEffect(() => {
    if (!didInitialScrollRef.current || actionBannerTopInset <= 0) return;

    preserveScrollOnLayoutShift();
    markStickToBottom();
    requestAnimationFrame(() => {
      scrollToLatest("auto");
    });
  }, [actionBannerTopInset, markStickToBottom, preserveScrollOnLayoutShift, scrollToLatest]);

  const onTimelineScroll = useCallback(() => {
    clearStickToBottomIfScrolledUp();
    syncNearBottomFromScroll();
  }, [clearStickToBottomIfScrolledUp, syncNearBottomFromScroll]);

  return {
    scrollRef,
    bottomRef,
    preserveScrollOnLayoutShift,
    onComposerFocus: anchorBeforeKeyboard,
    onTimelineScroll,
  };
}
