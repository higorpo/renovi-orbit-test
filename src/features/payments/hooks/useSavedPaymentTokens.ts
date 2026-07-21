import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { listActivePaymentTokens } from "../api/cards.api";

export const SAVED_PAYMENT_TOKENS_QUERY_KEY = ["payment-tokens", "active"];

export function useSavedPaymentTokens(enabled = true) {
  const { user } = useAuth();
  const clientId = user?.id ?? null;

  return useQuery({
    queryKey: [...SAVED_PAYMENT_TOKENS_QUERY_KEY, clientId],
    queryFn: async () => {
      const result = await listActivePaymentTokens();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: enabled && Boolean(clientId),
    staleTime: 30_000,
  });
}
