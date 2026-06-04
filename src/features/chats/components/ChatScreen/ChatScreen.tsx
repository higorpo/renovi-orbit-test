import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/features/auth";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { useVirtualKeyboardVisible } from "@/hooks/useVirtualKeyboardVisible";
import { cn } from "@/lib/utils";
import { ChatActionBanner } from "../ChatActionBanner/ChatActionBanner";
import { ChatActionBannerOverlayHost } from "../ChatActionBanner/ChatActionBannerOverlay";
import { useChatActionBannerState } from "../../hooks/useChatActionBannerState";
import { useChatComposerState } from "../../hooks/useChatComposerState";
import { useChatMessages } from "../../hooks/useChatMessages";
import { useMarkConversationRead } from "../../hooks/useMarkConversationRead";
import { useChatSentryContext } from "../../hooks/useChatSentryContext";
import { useConversationDetail } from "../../hooks/useConversationDetail";
import {
  isRealtimeConnectionHealthy,
  useConversationRealtime,
} from "../../hooks/useConversationRealtime";
import { useConversationPollingFallback } from "../../hooks/useConversationPollingFallback";
import { useConversationTypingPresence } from "../../hooks/useConversationTypingPresence";
import { usePushNotificationSuppression } from "../../hooks/usePushNotificationSuppression";
import { useChatActionBannerInset } from "../../hooks/useChatActionBannerInset";
import type { ChatActionBannerCtaPayload } from "../../hooks/useChatActionBannerState";
import type { ProposalCardAction } from "../DynamicMessageRenderer/DynamicProposalCard";
import { createClientSendId } from "../../utils/clientSendId";
import { deriveLatestProposalIdFromMessages } from "../../utils/deriveLatestProposalIdFromMessages";
import { resolveCounterpartyViewedMessageId } from "../../utils/resolveCounterpartyViewedMessageId";
import { ChatComposerBar } from "./ChatComposerBar";
import { ChatScreenHeader } from "./ChatScreenHeader";
import { ChatScreenSkeleton } from "./ChatScreenSkeleton";
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
    useConversationDetail(chatId, { activeChat: true });

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
    sendChatImages,
  } = useChatMessages(chatId);

  useMarkConversationRead(chatId, messages);

  const viewerRole = profile?.role === "provider" ? "provider" : "client";

  const composerState = useChatComposerState({
    chatId,
    conversationStatus: detail?.conversation.status ?? null,
    viewerRole,
  });
  const pendingProposalId = useMemo(
    () => deriveLatestProposalIdFromMessages(messages),
    [messages],
  );
  const hasPendingProposal = composerState.disabledReason === "pending_proposal";

  const { banner, isVisible: isBannerVisible, dismiss, getCtaPayload } = useChatActionBannerState({
    chatId,
    viewerRole,
    conversationStatus: detail?.conversation.status ?? "INACTIVE",
    pendingProposalId: hasPendingProposal ? pendingProposalId : null,
    primaryProposalStatus: hasPendingProposal ? "PENDING" : null,
    messages,
    clientId: detail?.conversation.client_id ?? null,
    providerId: detail?.conversation.provider_id ?? null,
    lastInteractionAt: detail?.conversation.last_interaction_at ?? null,
    enabled: Boolean(detail),
  });

  useChatSentryContext({
    chatId,
    serviceRequestId: detail?.service_request.id ?? null,
  });

  usePushNotificationSuppression(chatId);

  useConversationRealtime(chatId, {
    enabled: Boolean(detail),
    currentUserId: user?.id ?? null,
    serviceRequestId: detail?.service_request.id ?? null,
    providerId: detail?.conversation.provider_id ?? null,
    onReconcile: () => void refetchGapFill(),
    onRealtimeStatusChange: setRealtimeStatus,
  });

  useConversationPollingFallback({
    chatId,
    enabled: Boolean(detail),
    realtimeHealthy:
      realtimeStatus === null ? true : isRealtimeConnectionHealthy(realtimeStatus),
    onPoll: () => void refetchGapFill(),
  });

  const { isCounterpartyTyping, notifyComposerChange, notifyTypingStopNow } =
    useConversationTypingPresence({
      conversationId: chatId,
      currentUserId: user?.id ?? null,
      enabled: Boolean(detail),
    });

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    void navigate(-1);
  }, [navigate, onBack]);

  const handleComposerSend = useCallback(
    ({ text, files }: { text: string; files: File[] }) => {
      if (files.length > 0) {
        void sendChatImages(files, text);
        return;
      }

      if (text) {
        void sendChatMessage({
          messageType: "TEXT",
          payload: { text },
          clientSendId: createClientSendId(),
        });
      }
    },
    [sendChatImages, sendChatMessage],
  );

  const viewedReceiptMessageId = useMemo(
    () =>
      resolveCounterpartyViewedMessageId(
        messages,
        user?.id ?? null,
        detail?.counterparty_read_receipt,
      ),
    [detail?.counterparty_read_receipt, messages, user?.id],
  );

  const counterpartyName =
    detail?.counterparty.full_name?.trim() || "Participante";
  const serviceTitle =
    detail?.service_request.title || detail?.service.title || "Serviço";
  const isDesktop = useBreakpointMd();
  const isKeyboardVisible = useVirtualKeyboardVisible();
  const showActionBanner = Boolean(banner && isBannerVisible && detail);
  const hideActionBannerForKeyboard = !isDesktop && isKeyboardVisible;
  const showActionBannerOverlay = showActionBanner && !hideActionBannerForKeyboard;
  const bannerOverlayRef = useRef<HTMLDivElement>(null);
  const actionBannerTopInset = useChatActionBannerInset(bannerOverlayRef, showActionBannerOverlay);

  if (isDetailLoading) {
    return <ChatScreenSkeleton className={className} />;
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

      <div className="relative flex min-h-0 flex-1 flex-col">
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
          conversationCreatedAt={detail?.conversation.created_at}
          onLoadOlder={() => void fetchNextPage()}
          onRetry={() => void refetchMessages()}
          actionBannerTopInset={actionBannerTopInset}
          viewedReceiptMessageId={viewedReceiptMessageId}
        />

        <ChatActionBannerOverlayHost
          ref={bannerOverlayRef}
          show={showActionBanner}
          isDisplayed={showActionBannerOverlay}
        >
          {banner ? (
            <ChatActionBanner
              banner={banner}
              onDismiss={dismiss}
              onPrimaryAction={() => {
                const payload = getCtaPayload();
                if (payload && onBannerCta) onBannerCta(payload);
              }}
            />
          ) : null}
        </ChatActionBannerOverlayHost>
      </div>

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
        onSend={handleComposerSend}
        onComposerChange={notifyComposerChange}
        onTypingStopNow={notifyTypingStopNow}
      />
    </div>
  );
}
