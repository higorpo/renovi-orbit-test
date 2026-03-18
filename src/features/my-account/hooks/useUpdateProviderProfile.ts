import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { toast } from "sonner";

/* Toasts for provider account updates are shown once by MyAccountProviderPage after all updates complete. */
import {
  updateProviderPrivateProfile,
  updateProviderPublicProfile,
  type UpdateProviderPrivateParams,
  type UpdateProviderPublicParams,
  type GetProviderPublicResult,
} from "../api/providerProfile.api";

const PROVIDER_PRIVATE_QUERY_KEY = ["provider-profiles-private"];
const PROVIDER_PUBLIC_QUERY_KEY = ["provider-profiles-public"];

export function useUpdateProviderProfile() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const providerId = profile?.id ?? null;

  const privateMutation = useMutation({
    mutationFn: (params: UpdateProviderPrivateParams) =>
      updateProviderPrivateProfile(providerId!, params),
    onSuccess: (result) => {
      if (!result.error) {
        queryClient.invalidateQueries({ queryKey: [...PROVIDER_PRIVATE_QUERY_KEY, providerId] });
      }
    },
    onError: () => {
      toast.error("Não foi possível atualizar. Tente novamente.");
    },
  });

  const publicMutation = useMutation({
    mutationFn: (params: UpdateProviderPublicParams) =>
      updateProviderPublicProfile(providerId!, params),
    onSuccess: (result, params) => {
      if (!result.error) {
        const queryKey = [...PROVIDER_PUBLIC_QUERY_KEY, providerId];
        if (params.service_area_neighborhood_ids !== undefined) {
          // Neighborhoods changed: must refetch to get fresh JOIN data
          queryClient.invalidateQueries({ queryKey });
        } else {
          // Only simple fields changed: patch cache directly to avoid refetching neighborhood JOINs
          queryClient.setQueryData(queryKey, (old: GetProviderPublicResult | undefined) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: {
                ...old.data,
                ...(params.display_name !== undefined && { display_name: params.display_name }),
                ...(params.bio !== undefined && { bio: params.bio }),
                ...(params.profile_visibility !== undefined && { profile_visibility: params.profile_visibility }),
                ...(params.slug !== undefined && { slug: params.slug }),
              },
            };
          });
        }
      }
    },
    onError: () => {
      toast.error("Não foi possível atualizar o perfil. Tente novamente.");
    },
  });

  return {
    updatePrivateAsync: privateMutation.mutateAsync,
    updatePublicAsync: publicMutation.mutateAsync,
    isUpdatingPrivate: privateMutation.isPending,
    isUpdatingPublic: publicMutation.isPending,
  };
}
