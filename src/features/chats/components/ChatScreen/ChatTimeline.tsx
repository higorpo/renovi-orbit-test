import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ProfileRole } from "@/features/auth";
import { Button } from "@/components/ui/button";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";
import { useChatTimelinePrependScroll } from "../../hooks/useChatTimelinePrependScroll";
import { useSnapChatTimelineOnKeyboardOpen } from "../../hooks/useSnapChatTimelineOnKeyboardOpen";
import { isNearChatBottom } from "../../utils/chatTimelineScroll";
import type { ProposalCardAction } from "../DynamicMessageRenderer/DynamicProposalCard";
import type { ChatMessageListItem } from "../../types/chats.types";
import { resolveChatDiscoveryWelcomeAnchorIso } from "../../utils/chatDiscoveryWelcome";
import {
  buildChatTimelineItems,
  prependDiscoveryWelcomeToTimeline,
} from "../../utils/groupChatTimeline";
import { ChatDiscoveryWelcome } from "./ChatDiscoveryWelcome";
import { ChatMessageRow } from "./ChatMessageRow";
import { ChatTimelineScrollContext } from "./ChatTimelineScrollContext";

export interface ChatTimelineProps {
  resetKey?: string;
  chatId: string;
  messages: ChatMessageListItem[];
  currentUserId: string | null;
  counterpartyName: string;
  viewerRole: ProfileRole;
  onProposalAction?: (action: ProposalCardAction, proposalId: string) => void;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Conversation `created_at` — used for welcome date when there are no messages yet. */
  conversationCreatedAt?: string | null;
  onLoadOlder: () => void;
  onRetry?: () => void;
  /** Space reserved at the top when the action banner overlays the timeline. */
  actionBannerTopInset?: number;
  /** Outgoing message id below which to show the "Visualizado" label. */
  viewedReceiptMessageId?: string | null;
  className?: string;
}

export function ChatTimeline({
  resetKey,
  chatId,
  messages,
  currentUserId,
  counterpartyName,
  viewerRole,
  onProposalAction,
  isLoading,
  isError,
  errorMessage,
  hasNextPage,
  isFetchingNextPage,
  conversationCreatedAt,
  onLoadOlder,
  onRetry,
  actionBannerTopInset = 0,
  viewedReceiptMessageId = null,
  className,
}: ChatTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didInitialScrollRef = useRef(false);
  const isMobile = !useBreakpointMd();

  const showDiscoveryWelcome = !hasNextPage && !isFetchingNextPage;

  const timelineItems = useMemo(() => {
    const base = buildChatTimelineItems(messages, currentUserId);
    if (!showDiscoveryWelcome) return base;

    const anchorIso = resolveChatDiscoveryWelcomeAnchorIso(messages, conversationCreatedAt);
    return prependDiscoveryWelcomeToTimeline(base, anchorIso);
  }, [conversationCreatedAt, currentUserId, messages, showDiscoveryWelcome]);

  const lastTimelineMessageKey = useMemo(() => {
    for (let i = timelineItems.length - 1; i >= 0; i -= 1) {
      const item = timelineItems[i];
      if (item?.type === "message") return item.key;
    }
    return null;
  }, [timelineItems]);

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
    enabled: isMobile,
  });

  useChatTimelinePrependScroll(scrollRef, isFetchingNextPage, timelineItems.length);

  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [resetKey]);

  useEffect(() => {
    if (isLoading || timelineItems.length === 0 || didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    scrollToLatest("auto");
  }, [isLoading, scrollToLatest, timelineItems.length]);

  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    if (!didInitialScrollRef.current || !lastMessageId) return;
    const scrollEl = scrollRef.current;
    if (scrollEl && !isNearChatBottom(scrollEl)) return;
    scrollToLatest("smooth");
  }, [lastMessageId, scrollToLatest]);

  useEffect(() => {
    if (!didInitialScrollRef.current || actionBannerTopInset <= 0) return;

    preserveScrollOnLayoutShift();
    requestAnimationFrame(() => {
      scrollToLatest("auto");
    });
  }, [actionBannerTopInset, preserveScrollOnLayoutShift, scrollToLatest]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;

    syncNearBottomFromScroll();

    if (!hasNextPage || isFetchingNextPage) return;
    if (element.scrollTop <= 48) onLoadOlder();
  };

  if (isLoading) {
    return (
      <div className={cn("flex flex-1 items-center justify-center px-4", className)} aria-busy="true">
        <p className="text-sm text-muted-foreground">Carregando mensagens…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("flex flex-1 flex-col items-center justify-center gap-3 px-4", className)}>
        <p className="text-center text-sm text-muted-foreground">
          {errorMessage ?? "Não foi possível carregar as mensagens."}
        </p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        ) : null}
      </div>
    );
  }

  const timelineScrollStyle =
    actionBannerTopInset > 0
      ? {
          paddingTop: actionBannerTopInset,
          scrollPaddingTop: actionBannerTopInset,
          transition: "padding-top 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        }
      : {
          transition: "padding-top 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        };

  return (
    <ChatTimelineScrollContext.Provider
      value={{ preserveScrollOnLayoutShift, onComposerFocus: anchorBeforeKeyboard }}
    >
      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-2 touch-pan-y",
          className,
        )}
        style={timelineScrollStyle}
        onScroll={handleScroll}
        aria-label="Mensagens da conversa"
      >
      {isFetchingNextPage ? (
        <div
          className="flex justify-center py-3"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Carregando mensagens anteriores…
          </span>
        </div>
      ) : null}

      {timelineItems.map((item) => {
        if (item.type === "date") {
          return (
            <div key={item.key} className="my-4 flex justify-center">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {item.label}
              </span>
            </div>
          );
        }

        if (item.type === "discovery_welcome") {
          return (
            <div key={item.key} className="my-3">
              <ChatDiscoveryWelcome viewerRole={viewerRole} />
            </div>
          );
        }

        return (
          <div
            key={item.key}
            data-chat-timeline-last={item.key === lastTimelineMessageKey ? "true" : undefined}
          >
            <ChatMessageRow
              chatId={chatId}
              message={item.message}
              groupPosition={item.groupPosition}
              showIncomingAvatar={item.showIncomingAvatar}
              showGroupTimestamp={
                item.groupPosition === "single" || item.groupPosition === "last"
              }
              showReadReceipt={
                item.isOutgoing && item.message.id === viewedReceiptMessageId
              }
              isOutgoing={item.isOutgoing}
              counterpartyName={counterpartyName}
              viewerRole={viewerRole}
              onProposalAction={onProposalAction}
            />
          </div>
        );
      })}

      <div ref={bottomRef} className="h-1 w-full shrink-0" aria-hidden />
      </div>
    </ChatTimelineScrollContext.Provider>
  );
}
