import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "@/features/auth";
import {
  AcceptProposalDialog,
  canEditServiceRequestProposal,
  getProposalDetail,
  mapProposalDetailToSummary,
  ProposalComposerDialog,
  ProposalDetailsDialog,
  RejectProposalDialog,
  RevisionRequestDialog,
  useProposalDetail,
  type ProposalComposerMode,
  type ProposalDetailView,
  type ProposalSuggestedSlotRpc,
} from "@/features/negotiation-proposals";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CHAT_DETAILS_COLUMN_MEDIA_QUERY } from "../../constants/layout";
import type { ChatActionBannerCtaPayload } from "../../hooks/useChatActionBannerState";
import { useCloseConversationMutation } from "../../hooks/useCloseConversationMutation";
import { useConversationDetail } from "../../hooks/useConversationDetail";
import { useInvalidateChatProposalQueries } from "../../hooks/useInvalidateChatProposalQueries";
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
  const invalidateChatProposalQueries = useInvalidateChatProposalQueries(chatId ?? null);
  const serviceRequestId = detail?.service_request.id ?? null;
  const isProviderViewer = profile?.role === "provider";

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptProposalId, setAcceptProposalId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectProposalId, setRejectProposalId] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionProposalId, setRevisionProposalId] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [proposalComposerOpen, setProposalComposerOpen] = useState(false);
  const [proposalComposerMode, setProposalComposerMode] = useState<ProposalComposerMode>("create");
  const [proposalComposerInitialProposal, setProposalComposerInitialProposal] =
    useState<ProposalDetailView | null>(null);
  const [detailsProposalId, setDetailsProposalId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const proposalDetailQuery = useProposalDetail({
    proposalId: detailsProposalId,
    enabled: detailsDialogOpen,
    audience: isProviderViewer ? "provider" : "client",
  });

  const providerProposalSummary =
    isProviderViewer && proposalDetailQuery.data
      ? mapProposalDetailToSummary(proposalDetailQuery.data)
      : null;

  const revisionProposalDetailQuery = useProposalDetail({
    proposalId: revisionProposalId,
    enabled: revisionOpen,
    audience: isProviderViewer ? "provider" : "client",
  });

  useEffect(() => {
    setDetailsOpen(false);
    setConfirmCloseOpen(false);
    setProposalComposerOpen(false);
    setProposalComposerMode("create");
    setProposalComposerInitialProposal(null);
    setDetailsDialogOpen(false);
    setDetailsProposalId(null);
    setRejectOpen(false);
    setRejectProposalId(null);
    setRevisionOpen(false);
    setRevisionProposalId(null);
  }, [chatId]);

  const openProposalDetails = useCallback((proposalId: string) => {
    setDetailsProposalId(proposalId);
    setDetailsDialogOpen(true);
  }, []);

  const handleDetailsDialogOpenChange = useCallback((open: boolean) => {
    setDetailsDialogOpen(open);
    if (!open) setDetailsProposalId(null);
  }, []);

  const openProposalComposerCreate = useCallback(() => {
    setProposalComposerMode("create");
    setProposalComposerInitialProposal(null);
    setProposalComposerOpen(true);
  }, []);

  const openProposalComposerEdit = useCallback(async (proposalId: string) => {
    const result = await getProposalDetail(proposalId);
    if (result.error || !result.data) return;

    setProposalComposerMode("edit");
    setProposalComposerInitialProposal(result.data);
    setProposalComposerOpen(true);
  }, []);

  const handleProposalAction = useCallback(
    (action: ProposalCardAction, proposalId: string) => {
      if (action === "accept") {
        setAcceptProposalId(proposalId);
        setAcceptOpen(true);
        return;
      }

      if (action === "reject") {
        setRejectProposalId(proposalId);
        setRejectOpen(true);
        return;
      }

      if (action === "request_revision") {
        setRevisionProposalId(proposalId);
        setRevisionOpen(true);
        return;
      }

      if (action === "view_details") {
        openProposalDetails(proposalId);
        return;
      }

      if (action === "edit_proposal") {
        void openProposalComposerEdit(proposalId);
      }
    },
    [openProposalComposerEdit, openProposalDetails],
  );

  const handleBannerCta = useCallback(
    (payload: ChatActionBannerCtaPayload) => {
      if (payload.action === "close_conversation") {
        setConfirmCloseOpen(true);
        return;
      }

      if (payload.action === "send_proposal") {
        openProposalComposerCreate();
        return;
      }

      if (payload.action === "review_proposal" && payload.proposalId) {
        void openProposalComposerEdit(payload.proposalId);
        return;
      }

      if (payload.action === "view_proposal" && payload.proposalId) {
        openProposalDetails(payload.proposalId);
      }
    },
    [openProposalComposerCreate, openProposalComposerEdit, openProposalDetails],
  );

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
      <div className="flex h-full min-h-0 min-w-0 flex-1">
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
        serviceRequestId={serviceRequestId}
        proposalId={acceptProposalId}
        suggestedSlots={FALLBACK_SUGGESTED_SLOTS}
      />

      <RejectProposalDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        chatId={chatId}
        serviceRequestId={serviceRequestId}
        proposalId={rejectProposalId}
      />

      <RevisionRequestDialog
        open={revisionOpen}
        onOpenChange={setRevisionOpen}
        chatId={chatId}
        serviceRequestId={serviceRequestId}
        proposalId={revisionProposalId}
        revisionCount={revisionProposalDetailQuery.data?.revision_count ?? 0}
      />

      <ProposalComposerDialog
        open={proposalComposerOpen}
        onOpenChange={setProposalComposerOpen}
        chatId={chatId}
        serviceRequestId={serviceRequestId}
        mode={proposalComposerMode}
        initialProposal={proposalComposerInitialProposal}
        onSubmitted={() => invalidateChatProposalQueries()}
      />

      <ProposalDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={handleDetailsDialogOpenChange}
        summary={isProviderViewer ? providerProposalSummary : null}
        canEdit={canEditServiceRequestProposal(providerProposalSummary?.status)}
        onEdit={() => {
          if (!detailsProposalId) return;
          setDetailsDialogOpen(false);
          void openProposalComposerEdit(detailsProposalId);
        }}
        proposal={isProviderViewer ? null : proposalDetailQuery.data}
        isLoading={proposalDetailQuery.isLoading}
        isError={proposalDetailQuery.isError}
        onRetry={() => void proposalDetailQuery.refetch()}
        copyVariant={isProviderViewer ? "budget" : "proposal"}
      />
    </>
  );
}
