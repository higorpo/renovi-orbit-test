import {
  ProposalComposerDialog,
  ProposalDetailsDialog,
  canEditServiceRequestProposal,
} from "@/features/negotiation-proposals";
import type { useProviderServiceProposalDialogs } from "../../hooks/useProviderServiceProposalDialogs";

interface ProviderServiceProposalDialogsProps {
  dialogs: ReturnType<typeof useProviderServiceProposalDialogs>;
}

export function ProviderServiceProposalDialogs({ dialogs }: ProviderServiceProposalDialogsProps) {
  const {
    composerOpen,
    composerContext,
    composerInitialProposal,
    handleComposerOpenChange,
    invalidateAfterProposalMutation,
    detailsOpen,
    proposalDetailQuery,
    handleDetailsDialogOpenChange,
    openComposerEditFromDetails,
  } = dialogs;

  return (
    <>
      {composerContext ? (
        <ProposalComposerDialog
          open={composerOpen}
          onOpenChange={handleComposerOpenChange}
          chatId={composerContext.chatId}
          serviceRequestId={composerContext.serviceRequestId}
          mode="edit"
          initialProposal={composerInitialProposal}
          onSubmitted={invalidateAfterProposalMutation}
        />
      ) : null}

      {detailsOpen ? (
        <ProposalDetailsDialog
          open
          onOpenChange={handleDetailsDialogOpenChange}
          proposal={proposalDetailQuery.data}
          canEdit={canEditServiceRequestProposal(proposalDetailQuery.data?.status)}
          onEdit={() => void openComposerEditFromDetails()}
          isLoading={proposalDetailQuery.isLoading}
          isError={proposalDetailQuery.isError}
          onRetry={() => void proposalDetailQuery.refetch()}
          copyVariant="proposal"
          detailAudience="provider"
        />
      ) : null}
    </>
  );
}
