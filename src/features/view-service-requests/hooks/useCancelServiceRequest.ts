import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { toast } from "sonner";
import { cancelServiceRequest } from "../api/cancelServiceRequest.api";

const LIST_QUERY_KEY = ["view-service-requests", "list"];

export function useCancelServiceRequest() {
  const { user } = useAuth();
  const clientId = user?.id ?? "";
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (requestId: string) =>
      cancelServiceRequest({ id: requestId, clientId }),
    onSuccess: (_data, _requestId, _context) => {
      queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });
      toast.success("Serviço excluído com sucesso.");
    },
    onError: (_err, _requestId, _context) => {
      toast.error("Não foi possível excluir o serviço. Tente novamente.");
    },
  });

  return {
    cancelServiceRequest: mutation.mutate,
    isCancelling: mutation.isPending,
  };
}
