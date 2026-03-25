import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { rejectClientBudgetProposal } from "../api/clientBudgets.api";

export function useClientRejectBudgetProposal(serviceRequestId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { proposalId: string; reason: string }) => {
      const { data, error } = await rejectClientBudgetProposal({
        proposalId: input.proposalId,
        reason: input.reason,
      });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: async () => {
      toast.success("Orçamento recusado. O prestador receberá seu motivo.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["client-budget-detail", serviceRequestId],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: ["client-received-budgets"],
          refetchType: "active",
        }),
      ]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
