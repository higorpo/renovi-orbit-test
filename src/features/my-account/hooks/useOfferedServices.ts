import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import {
  listOfferedServices,
  setOfferedServices,
} from "../api/providerProfile.api";

const OFFERED_SERVICES_QUERY_KEY = ["provider-offered-services"];

export function useOfferedServices() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const providerId = profile?.id ?? null;
  const isProvider = profile?.role === "provider";

  const query = useQuery({
    queryKey: [...OFFERED_SERVICES_QUERY_KEY, providerId],
    queryFn: () => listOfferedServices(providerId!),
    enabled: Boolean(providerId && isProvider),
  });

  const mutation = useMutation({
    mutationFn: (serviceIds: string[]) => setOfferedServices(providerId!, serviceIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...OFFERED_SERVICES_QUERY_KEY, providerId] });
    },
  });

  return {
    serviceIds: query.data?.serviceIds ?? [],
    isLoading: query.isLoading,
    error: query.data?.error ?? query.error?.message ?? null,
    refetch: query.refetch,
    setServiceIds: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
