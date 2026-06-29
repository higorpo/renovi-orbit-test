import { useQuery } from "@tanstack/react-query";
import { listClientPaymentTransactions } from "../api/history.api";

export const CLIENT_PAYMENT_HISTORY_QUERY_KEY = ["payment-history", "client"];

export function useClientPaymentHistory(enabled = true) {
  return useQuery({
    queryKey: CLIENT_PAYMENT_HISTORY_QUERY_KEY,
    queryFn: async () => {
      const result = await listClientPaymentTransactions();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled,
    staleTime: 30_000,
  });
}
