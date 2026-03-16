import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { listAddresses } from "../api/addresses.api";

export const ADDRESSES_LIST_QUERY_KEY = ["addresses", "list"] as const;

export function useAddressesList() {
  const { user } = useAuth();
  const clientId = user?.id ?? "";

  const query = useQuery({
    queryKey: [...ADDRESSES_LIST_QUERY_KEY, clientId],
    queryFn: () => listAddresses(clientId),
    enabled: !!clientId,
  });

  return {
    addresses: query.data?.addresses ?? [],
    error: query.data?.error ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
