import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  markServiceExecuted,
  type MarkServiceExecutedSuccess,
} from "../api/markServiceExecuted.api";
import { SERVICE_DETAIL_QUERY_KEY, SERVICES_LIST_QUERY_KEY } from "../constants/queryKeys";

export function useMarkServiceExecuted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contractedServiceId: string): Promise<MarkServiceExecutedSuccess> => {
      const result = await markServiceExecuted(contractedServiceId);
      if (result.error || !result.data) {
        const error = new Error(result.error ?? "Falha ao marcar serviço como executado");
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
