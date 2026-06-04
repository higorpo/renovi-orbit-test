import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { rejectServiceRequestBudgetProposal } from "../api/serviceRequestBudgetCompare.api";
import { SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY } from "../constants/queryKeys";

export function useRejectServiceRequestBudgetProposal(serviceRequestId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { proposalId: string; reason: string }) => {
      const { data, error } = await rejectServiceRequestBudgetProposal({
        proposalId: input.proposalId,
        reason: input.reason,
      });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: async () => {
      toast.success("Orçamento recusado. O prestador receberá seu motivo.");
      await queryClient.invalidateQueries({
        queryKey: [SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY, serviceRequestId],
        refetchType: "active",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
