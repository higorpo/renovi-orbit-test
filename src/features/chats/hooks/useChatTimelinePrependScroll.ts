import { type RefObject, useEffect, useRef } from "react";
import { getScrollTopAfterPrepend } from "../utils/chatTimelineScroll";

type ScrollSnapshot = {
  scrollHeight: number;
  scrollTop: number;
};

/**
 * Restores scroll position after older messages (or welcome header) are prepended.
 */
export function useChatTimelinePrependScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  isFetchingNextPage: boolean,
  contentItemCount: number,
): void {
  const snapshotRef = useRef<ScrollSnapshot | null>(null);
  const wasFetchingOlderRef = useRef(false);

  useEffect(() => {
    const scrollEl = scrollRef.current;

    if (isFetchingNextPage && !wasFetchingOlderRef.current && scrollEl) {
      snapshotRef.current = {
        scrollHeight: scrollEl.scrollHeight,
        scrollTop: scrollEl.scrollTop,
      };
    }

    if (!isFetchingNextPage && wasFetchingOlderRef.current && snapshotRef.current && scrollEl) {
      const snapshot = snapshotRef.current;
      snapshotRef.current = null;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = scrollRef.current;
          if (!el) return;
          el.scrollTop = getScrollTopAfterPrepend(
            snapshot.scrollHeight,
            snapshot.scrollTop,
            el.scrollHeight,
          );
        });
      });
    }

    wasFetchingOlderRef.current = isFetchingNextPage;
  }, [contentItemCount, isFetchingNextPage, scrollRef]);
}
