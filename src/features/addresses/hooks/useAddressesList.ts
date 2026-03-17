import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { listAddresses } from "../api/addresses.api";
import type { ClientAddressWithRelations } from "../types/addresses.types";

export const ADDRESSES_LIST_QUERY_KEY = ["addresses", "list"] as const;

const EMPTY_ADDRESSES: ClientAddressWithRelations[] = [];

export function useAddressesList() {
  const { user } = useAuth();
  const clientId = user?.id ?? "";

  const query = useQuery({
    queryKey: [...ADDRESSES_LIST_QUERY_KEY, clientId],
    queryFn: () => listAddresses(clientId),
    enabled: !!clientId,
  });

  const addresses = useMemo(
    () => query.data?.addresses ?? EMPTY_ADDRESSES,
    [query.data?.addresses]
  );

  return {
    addresses,
    error: query.data?.error ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
