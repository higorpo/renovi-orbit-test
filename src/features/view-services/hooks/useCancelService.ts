import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cancelService } from "../api/services.api";
import { SERVICE_DETAIL_QUERY_KEY, SERVICES_LIST_QUERY_KEY } from "../constants/queryKeys";

export function useCancelService() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (serviceRequestId: string) => {
      const result = await cancelService(serviceRequestId);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (_data, serviceRequestId) => {
      void queryClient.invalidateQueries({ queryKey: SERVICES_LIST_QUERY_KEY });
      void queryClient.invalidateQueries({
        queryKey: [...SERVICE_DETAIL_QUERY_KEY, serviceRequestId],
      });
      toast.success("Serviço cancelado com sucesso.");
    },
    onError: () => {
      toast.error("Não foi possível cancelar o serviço. Tente novamente.");
    },
  });

  return {
    cancelService: mutation.mutate,
    isCancelling: mutation.isPending,
  };
}
