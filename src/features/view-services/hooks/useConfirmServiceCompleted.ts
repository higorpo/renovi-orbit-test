import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  confirmServiceCompleted,
  type ConfirmServiceCompletedSuccess,
} from "../api/confirmServiceCompleted.api";
import { SERVICE_DETAIL_QUERY_KEY, SERVICES_LIST_QUERY_KEY } from "../constants/queryKeys";

export function useConfirmServiceCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contractedServiceId: string): Promise<ConfirmServiceCompletedSuccess> => {
      const result = await confirmServiceCompleted(contractedServiceId);
      if (result.error || !result.data) {
        const error = new Error(result.error ?? "Falha ao confirmar recebimento");
        (error as Error & { errorCode?: string }).errorCode = result.errorCode;
        throw error;
      }
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SERVICES_LIST_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: SERVICE_DETAIL_QUERY_KEY });
    },
  });
}
