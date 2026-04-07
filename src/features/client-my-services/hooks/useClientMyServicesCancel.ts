import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { toast } from "sonner";
import { cancelServiceRequest } from "../api/serviceRequests.api";

const LIST_QUERY_KEY = ["client-my-services", "list"];

export function useClientMyServicesCancel() {
  const { user } = useAuth();
  const clientId = user?.id ?? "";
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (requestId: string) => {
      const result = await cancelServiceRequest({ id: requestId, clientId });
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (_data, _requestId, _context) => {
      queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });
      toast.success("Serviço cancelado com sucesso.");
    },
    onError: (_err, _requestId, _context) => {
      toast.error("Não foi possível cancelar o serviço. Tente novamente.");
    },
  });

  return {
    cancelServiceRequest: mutation.mutate,
    isCancelling: mutation.isPending,
  };
}
