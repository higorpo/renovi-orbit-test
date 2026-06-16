import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getProposalDetail,
  PROPOSAL_DETAIL_QUERY_KEY,
  useProposalDetail,
  type ProposalDetailView,
} from "@/features/negotiation-proposals";
import { SERVICES_LIST_QUERY_KEY, type ServiceModel } from "@/features/view-services";

export interface ProviderServiceProposalDialogContext {
  chatId: string;
  serviceRequestId: string;
}

export function useProviderServiceProposalDialogs() {
  const queryClient = useQueryClient();

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerInitialProposal, setComposerInitialProposal] =
    useState<ProposalDetailView | null>(null);
  const [composerContext, setComposerContext] =
    useState<ProviderServiceProposalDialogContext | null>(null);

  const [detailsOpen, setDetailsDialogOpen] = useState(false);
  const [detailsProposalId, setDetailsProposalId] = useState<string | null>(null);
  const [detailsContext, setDetailsContext] =
    useState<ProviderServiceProposalDialogContext | null>(null);

  const proposalDetailQuery = useProposalDetail({
    proposalId: detailsProposalId,
    enabled: detailsOpen,
    audience: "provider",
  });

  const invalidateAfterProposalMutation = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: SERVICES_LIST_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: [PROPOSAL_DETAIL_QUERY_KEY] });
  }, [queryClient]);

  const handleComposerOpenChange = useCallback((open: boolean) => {
    setComposerOpen(open);
    if (!open) {
      setComposerInitialProposal(null);
      setComposerContext(null);
    }
  }, []);

  const handleDetailsDialogOpenChange = useCallback((open: boolean) => {
    setDetailsDialogOpen(open);
    if (!open) {
      setDetailsProposalId(null);
      setDetailsContext(null);
    }
  }, []);

  const openReviseProposal = useCallback(async (model: ServiceModel) => {
    const proposalId = model.myProposal?.id;
    if (!proposalId) return;

    const result = await getProposalDetail(proposalId, "provider");
    if (result.error || !result.data) return;

    setComposerContext({
      chatId: model.chatSummary?.id ?? "",
      serviceRequestId: model.id,
    });
    setComposerInitialProposal(result.data);
    setComposerOpen(true);
  }, []);

  const openViewProposal = useCallback((model: ServiceModel) => {
    const proposalId = model.myProposal?.id;
    if (!proposalId) return;

    setDetailsContext({
      chatId: model.chatSummary?.id ?? "",
      serviceRequestId: model.id,
    });
    setDetailsProposalId(proposalId);
    setDetailsDialogOpen(true);
  }, []);

  const openComposerEditFromDetails = useCallback(async () => {
    if (!detailsProposalId || !detailsContext) return;

    const result = await getProposalDetail(detailsProposalId, "provider");
    if (result.error || !result.data) return;

    setDetailsDialogOpen(false);
    setComposerContext(detailsContext);
    setComposerInitialProposal(result.data);
    setComposerOpen(true);
    setDetailsProposalId(null);
    setDetailsContext(null);
  }, [detailsContext, detailsProposalId]);

  return {
    composerOpen,
    composerContext,
    composerInitialProposal,
    handleComposerOpenChange,
    invalidateAfterProposalMutation,
    detailsOpen,
    detailsProposalId,
    proposalDetailQuery,
    handleDetailsDialogOpenChange,
    openReviseProposal,
    openViewProposal,
    openComposerEditFromDetails,
  };
}
