import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { listServiceRequests } from "../api/listServiceRequests.api";
import { mapToServiceRequestCardModel } from "../mappers/serviceRequestCardMapper";
import type { ServiceRequestCardModel } from "../types/service-request-view.types";

const QUERY_KEY = ["view-service-requests", "list"];

export interface UseServiceRequestsListResult {
  items: ServiceRequestCardModel[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => void;
}

export function useServiceRequestsList(): UseServiceRequestsListResult {
  const { user } = useAuth();
  const clientId = user?.id ?? "";

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [...QUERY_KEY, clientId],
    queryFn: async () => {
      const result = await listServiceRequests({ clientId });
      if (result.error) throw new Error(result.error);
      return (result.data ?? []).map(mapToServiceRequestCardModel);
    },
    enabled: Boolean(clientId),
  });

  return {
    items: data ?? [],
    isLoading,
    isError,
    error: error instanceof Error ? error.message : isError ? "Erro ao carregar" : null,
    refetch,
  };
}
