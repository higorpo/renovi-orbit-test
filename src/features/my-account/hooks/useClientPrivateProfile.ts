import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import {
  getClientPrivateProfile,
  updateClientPrivateProfile,
  type UpdateClientPrivateParams,
} from "../api/clientProfilePrivate.api";

const CLIENT_PRIVATE_QUERY_KEY = ["client-profiles-private"];

/**
 * Fetches and updates the client's private profile (e.g. CPF) from client_profiles_private.
 * Use only when the user is a client (role === 'client').
 */
export function useClientPrivateProfile() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const clientId = user?.id ?? null;
  const isClient = profile?.role === "client";

  const query = useQuery({
    queryKey: [...CLIENT_PRIVATE_QUERY_KEY, clientId],
    queryFn: () => getClientPrivateProfile(clientId!),
    enabled: Boolean(clientId && isClient),
  });

  const mutation = useMutation({
    mutationFn: (params: UpdateClientPrivateParams) =>
      updateClientPrivateProfile(clientId!, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...CLIENT_PRIVATE_QUERY_KEY, clientId] });
    },
  });

  const data = query.data?.data ?? null;
  const cpf = data?.cpf ?? null;

  return {
    cpf,
    data,
    isLoading: query.isLoading,
    error: query.error?.message ?? query.data?.error ?? null,
    refetch: query.refetch,
    updateCpfAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
