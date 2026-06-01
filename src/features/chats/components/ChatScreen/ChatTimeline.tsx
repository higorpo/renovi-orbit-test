import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ProfileRole } from "@/features/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProposalCardAction } from "../DynamicMessageRenderer/DynamicProposalCard";
import type { ChatMessageListItem } from "../../types/chats.types";
import { buildChatTimelineItems } from "../../utils/groupChatTimeline";
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
  onLoadOlder: () => void;
  onRetry?: () => void;
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
  onLoadOlder,
  onRetry,
  className,
}: ChatTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didInitialScrollRef = useRef(false);

  const timelineItems = useMemo(
    () => buildChatTimelineItems(messages, currentUserId),
    [currentUserId, messages],
  );

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

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

  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [resetKey]);

  useEffect(() => {
    if (isLoading || messages.length === 0 || didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    scrollToLatest("auto");
  }, [isLoading, messages.length, scrollToLatest]);

  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    if (!didInitialScrollRef.current || !lastMessageId) return;
    scrollToLatest("smooth");
  }, [lastMessageId, scrollToLatest]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element || !hasNextPage || isFetchingNextPage) return;
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

  if (messages.length === 0) {
    return (
      <div
        className={cn("flex flex-1 items-center justify-center px-4 py-6", className)}
        role="status"
      >
        <ChatDiscoveryWelcome viewerRole={viewerRole} />
      </div>
    );
  }

  return (
    <ChatTimelineScrollContext.Provider value={{ preserveScrollOnLayoutShift }}>
      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-2 touch-pan-y",
          className,
        )}
        onScroll={handleScroll}
        aria-label="Mensagens da conversa"
      >
      {hasNextPage ? (
        <div className="flex justify-center py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={onLoadOlder}
          >
            {isFetchingNextPage ? "Carregando mensagens anteriores…" : "Carregar mensagens anteriores"}
          </Button>
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

        return (
          <ChatMessageRow
            key={item.key}
            chatId={chatId}
            message={item.message}
            groupPosition={item.groupPosition}
            showIncomingAvatar={item.showIncomingAvatar}
            isOutgoing={item.isOutgoing}
            counterpartyName={counterpartyName}
            viewerRole={viewerRole}
            onProposalAction={onProposalAction}
          />
        );
      })}

      <div ref={bottomRef} className="h-1 w-full shrink-0" aria-hidden />
      </div>
    </ChatTimelineScrollContext.Provider>
  );
}
