import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "@/features/auth";
import { AcceptProposalDialog } from "@/features/negotiation-proposals";
import type { ProposalSuggestedSlotRpc } from "@/features/negotiation-proposals";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CHAT_DETAILS_COLUMN_MEDIA_QUERY } from "../../constants/layout";
import type { ChatActionBannerCtaPayload } from "../../hooks/useChatActionBannerState";
import { useCloseConversationMutation } from "../../hooks/useCloseConversationMutation";
import { useConversationDetail } from "../../hooks/useConversationDetail";
import {
  CloseConversationConfirmDialog,
} from "../ChatDetails/ChatDetailsActions";
import { ChatDetailsDesktopPanel } from "../ChatDetails/ChatDetailsDesktopPanel";
import { ChatDetailsMobileSheet } from "../ChatDetails/ChatDetailsMobileSheet";
import type { ProposalCardAction } from "../DynamicMessageRenderer/DynamicProposalCard";
import { ChatScreen } from "../ChatScreen/ChatScreen";

const FALLBACK_SUGGESTED_SLOTS: ProposalSuggestedSlotRpc[] = [
  { start_date: "2026-06-15", shift: "morning" },
];

export function ChatsConversationRoute() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const showDetailsColumn = useMediaQuery(CHAT_DETAILS_COLUMN_MEDIA_QUERY);
  const { detail } = useConversationDetail(chatId ?? null);
  const closeConversationMutation = useCloseConversationMutation(chatId ?? null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptProposalId, setAcceptProposalId] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  useEffect(() => {
    setDetailsOpen(false);
    setConfirmCloseOpen(false);
  }, [chatId]);

  const handleProposalAction = useCallback((action: ProposalCardAction, proposalId: string) => {
    if (action === "accept") {
      setAcceptProposalId(proposalId);
      setAcceptOpen(true);
    }
  }, []);

  const handleBannerCta = useCallback((payload: ChatActionBannerCtaPayload) => {
    if (payload.action === "close_conversation") {
      setConfirmCloseOpen(true);
    }
  }, []);

  const handleArchiveRequest = useCallback(() => {
    setConfirmCloseOpen(true);
  }, []);

  const handleConfirmClose = useCallback(() => {
    closeConversationMutation.mutate(undefined, {
      onSuccess: () => {
        setConfirmCloseOpen(false);
        setDetailsOpen(false);
      },
    });
  }, [closeConversationMutation]);

  if (!chatId) return null;

  return (
    <>
      <div className="flex h-full min-h-0 flex-1">
        <ChatScreen
          chatId={chatId}
          onBack={() => void navigate("/dashboard/chats")}
          onDetails={() => setDetailsOpen(true)}
          onBannerCta={handleBannerCta}
          onProposalAction={handleProposalAction}
          className="min-h-0 min-w-0 flex-1"
        />

        {showDetailsColumn && detailsOpen && detail && profile ? (
          <ChatDetailsDesktopPanel
            detail={detail}
            currentUser={profile}
            onClose={() => setDetailsOpen(false)}
            onArchive={handleArchiveRequest}
            isArchiving={closeConversationMutation.isPending}
          />
        ) : null}
      </div>

      {!showDetailsColumn ? (
        <ChatDetailsMobileSheet
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          detail={detail}
          currentUser={profile}
          onArchive={handleArchiveRequest}
          isArchiving={closeConversationMutation.isPending}
        />
      ) : null}

      <CloseConversationConfirmDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        onConfirm={handleConfirmClose}
        isPending={closeConversationMutation.isPending}
      />

      <AcceptProposalDialog
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        chatId={chatId}
        serviceRequestId={detail?.service_request.id ?? null}
        proposalId={acceptProposalId}
        suggestedSlots={FALLBACK_SUGGESTED_SLOTS}
      />
    </>
  );
}
