import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, profileApi } from "@/features/auth";
import { toast } from "sonner";
import { ACCOUNT_PROFILE_QUERY_KEY } from "./useAccountProfile";

export interface UpdateAccountProfileParams {
  full_name?: string;
  phone?: string | null;
}

export interface UseUpdateAccountProfileOptions {
  /** When true, success/error toasts are not shown (e.g. when caller shows a single toast). */
  silent?: boolean;
}

export function useUpdateAccountProfile(options?: UseUpdateAccountProfileOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const silent = options?.silent ?? false;

  const mutation = useMutation({
    mutationFn: (params: UpdateAccountProfileParams) => {
      if (!user?.id) throw new Error("Not authenticated");
      return profileApi.updateProfile(user.id, params);
    },
    onSuccess: (result) => {
      if (result.error) return;
      queryClient.invalidateQueries({ queryKey: ACCOUNT_PROFILE_QUERY_KEY });
      if (!silent) toast.success("Dados atualizados com sucesso.");
    },
    onError: () => {
      if (!silent) toast.error("Não foi possível atualizar. Tente novamente.");
    },
  });

  return {
    updateProfile: mutation.mutate,
    updateProfileAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
