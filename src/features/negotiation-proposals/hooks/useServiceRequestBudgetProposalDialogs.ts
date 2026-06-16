import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProposalDetail } from "./useProposalDetail";
import { SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY } from "../constants/queryKeys";
import { buildDateUnavailableRevisionInitialValues } from "../utils/buildDateUnavailableRevisionInitialValues";
import type { RevisionRequestInitialValues } from "../types/proposals.types";
import type { ClientProposalCta } from "../utils/clientProposalCtas";

export function useServiceRequestBudgetProposalDialogs(serviceRequestId: string | null) {
  const queryClient = useQueryClient();

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptProposalId, setAcceptProposalId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectProposalId, setRejectProposalId] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionProposalId, setRevisionProposalId] = useState<string | null>(null);
  const [revisionInitialValues, setRevisionInitialValues] =
    useState<RevisionRequestInitialValues | null>(null);

  const acceptProposalDetailQuery = useProposalDetail({
    proposalId: acceptProposalId,
    enabled: acceptOpen,
    audience: "client",
  });

  const revisionProposalDetailQuery = useProposalDetail({
    proposalId: revisionProposalId,
    enabled: revisionOpen,
    audience: "client",
  });

  const invalidateBudgetCompare = useCallback(() => {
    if (!serviceRequestId) return;
    void queryClient.invalidateQueries({
      queryKey: [SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY, serviceRequestId],
      refetchType: "active",
    });
  }, [queryClient, serviceRequestId]);

  const handleProposalAction = useCallback((action: ClientProposalCta["id"], proposalId: string) => {
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
    }
  }, []);

  const handleAcceptDialogOpenChange = useCallback(
    (open: boolean) => {
      setAcceptOpen(open);
      if (!open) {
        setAcceptProposalId(null);
        invalidateBudgetCompare();
      }
    },
    [invalidateBudgetCompare],
  );

  const handleRejectDialogOpenChange = useCallback(
    (open: boolean) => {
      setRejectOpen(open);
      if (!open) {
        setRejectProposalId(null);
        invalidateBudgetCompare();
      }
    },
    [invalidateBudgetCompare],
  );

  const handleRevisionDialogOpenChange = useCallback(
    (open: boolean) => {
      setRevisionOpen(open);
      if (!open) {
        setRevisionProposalId(null);
        setRevisionInitialValues(null);
        invalidateBudgetCompare();
      }
    },
    [invalidateBudgetCompare],
  );

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
    handleRejectDialogOpenChange,
    revisionOpen,
    revisionProposalId,
    revisionInitialValues,
    revisionProposalDetailQuery,
    handleRevisionDialogOpenChange,
    handleProposalAction,
  };
}
