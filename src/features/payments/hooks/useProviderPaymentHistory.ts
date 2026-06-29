import { useQuery } from "@tanstack/react-query";
import { listProviderPaymentReceivables } from "../api/history.api";

export const PROVIDER_PAYMENT_HISTORY_QUERY_KEY = ["payment-history", "provider"];

export function useProviderPaymentHistory(enabled = true) {
  return useQuery({
    queryKey: PROVIDER_PAYMENT_HISTORY_QUERY_KEY,
    queryFn: async () => {
      const result = await listProviderPaymentReceivables();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled,
    staleTime: 30_000,
  });
}
