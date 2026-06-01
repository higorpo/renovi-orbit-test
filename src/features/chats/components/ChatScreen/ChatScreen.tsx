import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/features/auth";
import { cn } from "@/lib/utils";
import { markConversationRead } from "../../api/chats.api";
import { ChatActionBannerSlot } from "../ChatActionBanner/ChatActionBanner";
import { useChatActionBannerState } from "../../hooks/useChatActionBannerState";
import { useChatComposerState } from "../../hooks/useChatComposerState";
import { useChatMessages } from "../../hooks/useChatMessages";
import { useChatSentryContext } from "../../hooks/useChatSentryContext";
import { useConversationDetail } from "../../hooks/useConversationDetail";
import {
  isRealtimeConnectionHealthy,
  useConversationRealtime,
} from "../../hooks/useConversationRealtime";
import { useConversationPollingFallback } from "../../hooks/useConversationPollingFallback";
import { useConversationTypingPresence } from "../../hooks/useConversationTypingPresence";
import { usePushNotificationSuppression } from "../../hooks/usePushNotificationSuppression";
import type { ChatActionBannerCtaPayload } from "../../hooks/useChatActionBannerState";
import type { ProposalCardAction } from "../DynamicMessageRenderer/DynamicProposalCard";
import { ChatComposerBar } from "./ChatComposerBar";
import { ChatScreenHeader } from "./ChatScreenHeader";
import { ChatTimeline } from "./ChatTimeline";

export interface ChatScreenProps {
  chatId: string;
  onBack?: () => void;
  onDetails?: () => void;
  onBannerCta?: (payload: ChatActionBannerCtaPayload) => void;
  onProposalAction?: (action: ProposalCardAction, proposalId: string) => void;
  className?: string;
}

export function ChatScreen({
  chatId,
  onBack,
  onDetails,
  onBannerCta,
  onProposalAction,
  className,
}: ChatScreenProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null);

  const { detail, isLoading: isDetailLoading, isError: isDetailError, error: detailError, refetch: refetchDetail } =
    useConversationDetail(chatId);

  const {
    messages,
    isLoading: isMessagesLoading,
    isError: isMessagesError,
    error: messagesError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch: refetchMessages,
    refetchGapFill,
    sendChatMessage,
    isSending,
  } = useChatMessages(chatId);

  const composerState = useChatComposerState({
    chatId,
    conversationStatus: detail?.conversation.status ?? null,
  });

  const viewerRole = profile?.role === "provider" ? "provider" : "client";

  const { banner, isVisible: isBannerVisible, dismiss, getCtaPayload } = useChatActionBannerState({
    chatId,
    viewerRole,
    conversationStatus: detail?.conversation.status ?? "INACTIVE",
    enabled: Boolean(detail),
  });

  useChatSentryContext({
    chatId,
    serviceRequestId: detail?.service_request.id ?? null,
  });

  usePushNotificationSuppression(chatId);

  useConversationRealtime(chatId, {
    onReconcile: () => void refetchGapFill(),
    onRealtimeStatusChange: setRealtimeStatus,
  });

  useConversationPollingFallback({
    chatId,
    realtimeHealthy: isRealtimeConnectionHealthy(realtimeStatus),
    onPoll: () => void refetchGapFill(),
  });

  const { isCounterpartyTyping, notifyComposerDraftChange } = useConversationTypingPresence({
    conversationId: chatId,
    currentUserId: user?.id ?? null,
    enabled: Boolean(detail),
    realtimeHealthy: isRealtimeConnectionHealthy(realtimeStatus),
  });

  useEffect(() => {
    if (!chatId || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    void markConversationRead({
      chatId,
      lastReadMessageId: lastMessage?.id.startsWith("optimistic:") ? null : lastMessage?.id,
    });
  }, [chatId, messages]);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    void navigate(-1);
  }, [navigate, onBack]);

  const handleSend = useCallback(
    async (text: string) => {
      await sendChatMessage({
        messageType: "TEXT",
        payload: { text },
        clientSendId: crypto.randomUUID(),
      });
    },
    [sendChatMessage],
  );

  const counterpartyName =
    detail?.counterparty.full_name?.trim() || "Participante";
  const serviceTitle =
    detail?.service_request.title || detail?.service.title || "Serviço";

  if (isDetailLoading) {
    return (
      <div className={cn("flex h-full min-h-0 flex-col items-center justify-center", className)}>
        <p className="text-sm text-muted-foreground">Carregando conversa…</p>
      </div>
    );
  }

  if (isDetailError || !detail) {
    return (
      <div className={cn("flex h-full min-h-0 flex-col items-center justify-center gap-3 px-4", className)}>
        <p className="text-center text-sm text-muted-foreground">
          {detailError instanceof Error ? detailError.message : "Não foi possível abrir esta conversa."}
        </p>
        <button
          type="button"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => void refetchDetail()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
      <ChatScreenHeader
        counterpartyName={counterpartyName}
        serviceTitle={serviceTitle}
        conversationStatus={detail.conversation.status}
        onBack={handleBack}
        onDetails={onDetails}
      />

      {banner ? (
        <div className="shrink-0 px-4 py-3">
          <ChatActionBannerSlot
            banner={banner}
            isVisible={isBannerVisible}
            onDismiss={dismiss}
            onPrimaryAction={() => {
              const payload = getCtaPayload();
              if (payload && onBannerCta) onBannerCta(payload);
            }}
          />
        </div>
      ) : null}

      <ChatTimeline
        resetKey={chatId}
        chatId={chatId}
        messages={messages}
        currentUserId={user?.id ?? null}
        counterpartyName={counterpartyName}
        viewerRole={viewerRole}
        onProposalAction={onProposalAction}
        isLoading={isMessagesLoading}
        isError={isMessagesError}
        errorMessage={messagesError instanceof Error ? messagesError.message : undefined}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadOlder={() => void fetchNextPage()}
        onRetry={() => void refetchMessages()}
      />

      {isCounterpartyTyping ? (
        <p className="shrink-0 px-4 py-1 text-xs text-muted-foreground" aria-live="polite">
          {counterpartyName} está digitando…
        </p>
      ) : null}

      <ChatComposerBar
        composer={{
          isInputEnabled: composerState.isInputEnabled,
          isAttachmentEnabled: composerState.isAttachmentEnabled,
          isSendEnabled: composerState.isSendEnabled,
          disabledReason: composerState.disabledReason,
          helperText: composerState.helperText,
          placeholder: composerState.placeholder,
        }}
        isSending={isSending}
        onSend={handleSend}
        onDraftChange={notifyComposerDraftChange}
      />
    </div>
  );
}
