import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelDispatch } from "../api/dispatchCancel.api";

export function useCancelDispatch() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ dispatchId, reason }: { dispatchId: string; reason?: string }) => {
      const { result, error } = await cancelDispatch({ dispatchId, reason });
      if (error) throw new Error(error);
      return result;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["message-dispatcher", "audit-timeline", variables.dispatchId],
      });
      queryClient.invalidateQueries({
        queryKey: ["message-dispatcher"],
        exact: false,
      });
    },
  });

  return {
    cancel: (dispatchId: string, reason?: string) =>
      mutation.mutateAsync({ dispatchId, reason }),
    isPending: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}
