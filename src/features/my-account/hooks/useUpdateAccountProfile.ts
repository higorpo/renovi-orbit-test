import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, profileApi } from "@/features/auth";
import { toast } from "sonner";
import { ACCOUNT_PROFILE_QUERY_KEY } from "./useAccountProfile";

export interface UpdateAccountProfileParams {
  full_name?: string;
  phone?: string | null;
  cpf?: string | null;
}

export function useUpdateAccountProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (params: UpdateAccountProfileParams) => {
      if (!user?.id) throw new Error("Not authenticated");
      return profileApi.updateProfile(user.id, params);
    },
    onSuccess: (result) => {
      if (result.error) return;
      queryClient.invalidateQueries({ queryKey: ACCOUNT_PROFILE_QUERY_KEY });
      toast.success("Dados atualizados com sucesso.");
    },
    onError: () => {
      toast.error("Não foi possível atualizar. Tente novamente.");
    },
  });

  return {
    updateProfile: mutation.mutate,
    updateProfileAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
