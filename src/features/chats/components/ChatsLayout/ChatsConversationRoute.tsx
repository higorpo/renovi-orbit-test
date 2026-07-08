import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useAuth } from "@/features/auth";
import {
  AcceptProposalDialog,
  canEditServiceRequestProposal,
  ProposalComposerDialog,
  ProposalDetailsDialog,
  RejectProposalDialog,
  RevisionRequestDialog,
} from "@/features/negotiation-proposals";
import {
  AcceptRescheduleDialog,
  CancelRescheduleDialog,
  ProposeRescheduleDialog,
  RequestAdjustmentRescheduleDialog,
  useChatRescheduleDialogs,
} from "@/features/service-reschedule";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CHAT_DETAILS_COLUMN_MEDIA_QUERY } from "../../constants/layout";
import { ROUTE_CHATS_LIST } from "../../constants/routes";
import type { ChatActionBannerCtaPayload } from "../../hooks/useChatActionBannerState";
import { useChatProposalDialogs } from "../../hooks/useChatProposalDialogs";
import { useCloseConversationMutation } from "../../hooks/useCloseConversationMutation";
import { useConversationDetail } from "../../hooks/useConversationDetail";
import { useInvalidateChatProposalQueries } from "../../hooks/useInvalidateChatProposalQueries";
import { useInvalidateChatRescheduleQueries } from "../../hooks/useInvalidateChatRescheduleQueries";
import {
  CloseConversationConfirmDialog,
} from "../ChatDetails/ChatDetailsActions";
import { ChatDetailsDesktopPanel } from "../ChatDetails/ChatDetailsDesktopPanel";
import { ChatDetailsMobileSheet } from "../ChatDetails/ChatDetailsMobileSheet";
import { ChatScreen } from "../ChatScreen/ChatScreen";

export function ChatsConversationRoute() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const showDetailsColumn = useMediaQuery(CHAT_DETAILS_COLUMN_MEDIA_QUERY);
  const { detail } = useConversationDetail(chatId ?? null);
  const closeConversationMutation = useCloseConversationMutation(chatId ?? null);
  const invalidateChatProposalQueries = useInvalidateChatProposalQueries(chatId ?? null);
  const invalidateChatRescheduleQueries = useInvalidateChatRescheduleQueries(chatId ?? null);
  const serviceRequestId = detail?.service_request.id ?? null;
  const isProviderViewer = profile?.role === "provider";

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const {
    acceptOpen,
    acceptProposalId,
    acceptProposalDetailQuery,
    handleAcceptDialogOpenChange,
    handleAcceptRequestRevision,
    rejectOpen,
    rejectProposalId,
    setRejectOpen,
    revisionOpen,
    revisionProposalId,
    revisionInitialValues,
    revisionProposalDetailQuery,
    handleRevisionDialogOpenChange,
    proposalComposerOpen,
    setProposalComposerOpen,
    proposalComposerMode,
    proposalComposerInitialProposal,
    openProposalComposerCreate,
    openProposalComposerEdit,
    detailsDialogOpen,
    detailsProposalId,
    proposalDetailQuery,
    openProposalDetails,
    handleDetailsDialogOpenChange,
    handleProposalAction,
  } = useChatProposalDialogs({
    chatId: chatId ?? null,
    isProviderViewer,
  });

  const {
    proposeOpen,
    setProposeOpen,
    acceptOpen: acceptRescheduleOpen,
    setAcceptOpen: setAcceptRescheduleOpen,
    adjustmentOpen,
    setAdjustmentOpen,
    cancelOpen,
    setCancelOpen,
    activeRequestId,
    handleRescheduleAction,
    openProposeDialog,
    openAcceptDialog,
  } = useChatRescheduleDialogs(chatId ?? null);

  const handleRescheduleSuccess = useCallback(() => {
    invalidateChatRescheduleQueries();
  }, [invalidateChatRescheduleQueries]);

  useEffect(() => {
    setDetailsOpen(false);
    setConfirmCloseOpen(false);
  }, [chatId]);

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
        return;
      }

      if (payload.action === "propose_reschedule" && payload.rescheduleRequestId) {
        openProposeDialog(payload.rescheduleRequestId);
        return;
      }

      if (payload.action === "accept_reschedule" && payload.rescheduleRequestId) {
        openAcceptDialog(payload.rescheduleRequestId);
      }
    },
    [
      openProposalComposerCreate,
      openProposalComposerEdit,
      openProposalDetails,
      openProposeDialog,
      openAcceptDialog,
    ],
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
          onBack={() => void navigate(`${ROUTE_CHATS_LIST}${location.search}`)}
          onDetails={() => setDetailsOpen(true)}
          onBannerCta={handleBannerCta}
          onProposalAction={handleProposalAction}
          onRescheduleAction={handleRescheduleAction}
          className="min-h-0 min-w-0 flex-1"
        />

        {showDetailsColumn && detailsOpen && detail && profile ? (
          <ChatDetailsDesktopPanel
            detail={detail}
            currentUser={profile}
            onClose={() => setDetailsOpen(false)}
            onArchive={handleArchiveRequest}
            onViewProposalDetails={openProposalDetails}
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
          onViewProposalDetails={openProposalDetails}
          isArchiving={closeConversationMutation.isPending}
        />
      ) : null}

      <CloseConversationConfirmDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        onConfirm={handleConfirmClose}
        isPending={closeConversationMutation.isPending}
      />

      {acceptOpen ? (
        <AcceptProposalDialog
          open
          onOpenChange={handleAcceptDialogOpenChange}
          chatId={chatId}
          serviceRequestId={serviceRequestId}
          proposalId={acceptProposalId}
          suggestedSlots={acceptProposalDetailQuery.data?.proposal_suggested_slots ?? []}
          serviceTitle={detail?.service_request.title}
          isLoading={acceptProposalDetailQuery.isLoading}
          isError={acceptProposalDetailQuery.isError}
          onRetry={() => void acceptProposalDetailQuery.refetch()}
          revisionCount={acceptProposalDetailQuery.data?.revision_count ?? 0}
          onRequestRevision={handleAcceptRequestRevision}
        />
      ) : null}

      {rejectOpen ? (
        <RejectProposalDialog
          open
          onOpenChange={setRejectOpen}
          chatId={chatId}
          serviceRequestId={serviceRequestId}
          proposalId={rejectProposalId}
        />
      ) : null}

      {revisionOpen ? (
        <RevisionRequestDialog
          open
          onOpenChange={handleRevisionDialogOpenChange}
          chatId={chatId}
          serviceRequestId={serviceRequestId}
          proposalId={revisionProposalId}
          revisionCount={revisionProposalDetailQuery.data?.revision_count ?? 0}
          initialValues={revisionInitialValues}
          isLoading={revisionProposalDetailQuery.isLoading}
        />
      ) : null}

      <ProposalComposerDialog
        open={proposalComposerOpen}
        onOpenChange={setProposalComposerOpen}
        chatId={chatId}
        serviceRequestId={serviceRequestId}
        mode={proposalComposerMode}
        initialProposal={proposalComposerInitialProposal}
        onSubmitted={invalidateChatProposalQueries}
      />

      {detailsDialogOpen ? (
        <ProposalDetailsDialog
          open
          onOpenChange={handleDetailsDialogOpenChange}
          proposal={proposalDetailQuery.data}
          canEdit={
            isProviderViewer &&
            canEditServiceRequestProposal(proposalDetailQuery.data?.status)
          }
          onEdit={() => {
            if (!detailsProposalId) return;
            handleDetailsDialogOpenChange(false);
            void openProposalComposerEdit(detailsProposalId);
          }}
          isLoading={proposalDetailQuery.isLoading}
          isError={proposalDetailQuery.isError}
          onRetry={() => void proposalDetailQuery.refetch()}
          copyVariant="proposal"
          detailAudience={isProviderViewer ? "provider" : "client"}
        />
      ) : null}

      <ProposeRescheduleDialog
        open={proposeOpen}
        onOpenChange={setProposeOpen}
        rescheduleRequestId={activeRequestId}
        onSuccess={handleRescheduleSuccess}
      />

      <AcceptRescheduleDialog
        open={acceptRescheduleOpen}
        onOpenChange={setAcceptRescheduleOpen}
        rescheduleRequestId={activeRequestId}
        onSuccess={handleRescheduleSuccess}
      />

      <RequestAdjustmentRescheduleDialog
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        rescheduleRequestId={activeRequestId}
        onSuccess={handleRescheduleSuccess}
      />

      <CancelRescheduleDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        rescheduleRequestId={activeRequestId}
        onSuccess={handleRescheduleSuccess}
      />
    </>
  );
}
