import { useCallback, useEffect, useState } from "react";
import {
  buildDateUnavailableRevisionInitialValues,
  getProposalDetail,
  useProposalDetail,
  type ProposalComposerMode,
  type ProposalDetailView,
  type RevisionRequestInitialValues,
} from "@/features/negotiation-proposals";
import type { ProposalCardAction } from "../components/DynamicMessageRenderer/DynamicProposalCard";

export interface UseChatProposalDialogsParams {
  chatId: string | null;
  isProviderViewer: boolean;
}

export function useChatProposalDialogs({
  chatId,
  isProviderViewer,
}: UseChatProposalDialogsParams) {
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptProposalId, setAcceptProposalId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectProposalId, setRejectProposalId] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionProposalId, setRevisionProposalId] = useState<string | null>(null);
  const [revisionInitialValues, setRevisionInitialValues] =
    useState<RevisionRequestInitialValues | null>(null);
  const [proposalComposerOpen, setProposalComposerOpen] = useState(false);
  const [proposalComposerMode, setProposalComposerMode] = useState<ProposalComposerMode>("create");
  const [proposalComposerInitialProposal, setProposalComposerInitialProposal] =
    useState<ProposalDetailView | null>(null);
  const [detailsProposalId, setDetailsProposalId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const proposalDetailAudience = isProviderViewer ? "provider" : "client";

  const proposalDetailQuery = useProposalDetail({
    proposalId: detailsProposalId,
    enabled: detailsDialogOpen,
    audience: proposalDetailAudience,
  });

  const revisionProposalDetailQuery = useProposalDetail({
    proposalId: revisionProposalId,
    enabled: revisionOpen,
    audience: proposalDetailAudience,
  });

  const acceptProposalDetailQuery = useProposalDetail({
    proposalId: acceptProposalId,
    enabled: acceptOpen,
    audience: "client",
  });

  useEffect(() => {
    setProposalComposerOpen(false);
    setProposalComposerMode("create");
    setProposalComposerInitialProposal(null);
    setDetailsDialogOpen(false);
    setDetailsProposalId(null);
    setRejectOpen(false);
    setRejectProposalId(null);
    setRevisionOpen(false);
    setRevisionProposalId(null);
    setRevisionInitialValues(null);
    setAcceptOpen(false);
    setAcceptProposalId(null);
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
        setRevisionInitialValues(null);
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

  const handleAcceptDialogOpenChange = useCallback((open: boolean) => {
    setAcceptOpen(open);
    if (!open) setAcceptProposalId(null);
  }, []);

  const handleRevisionDialogOpenChange = useCallback((open: boolean) => {
    setRevisionOpen(open);
    if (!open) {
      setRevisionProposalId(null);
      setRevisionInitialValues(null);
    }
  }, []);

  const handleAcceptRequestRevision = useCallback(() => {
    const proposalId = acceptProposalId;
    if (!proposalId) return;

    const suggestedSlots = acceptProposalDetailQuery.data?.proposal_suggested_slots ?? [];
    setRevisionInitialValues(buildDateUnavailableRevisionInitialValues(suggestedSlots));
    setRevisionProposalId(proposalId);
    setAcceptOpen(false);
    setAcceptProposalId(null);
    setRevisionOpen(true);
  }, [acceptProposalId, acceptProposalDetailQuery.data?.proposal_suggested_slots]);

  return {
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
  };
}
