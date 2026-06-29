import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  revokePaymentToken,
  type RevokePaymentTokenOutcome,
} from "../api/cards.api";
import { SAVED_PAYMENT_TOKENS_QUERY_KEY, useSavedPaymentTokens } from "./useSavedPaymentTokens";

export function useSavedCards(enabled = true) {
  const queryClient = useQueryClient();
  const tokensQuery = useSavedPaymentTokens(enabled);

  const revokeMutation = useMutation({
    mutationFn: async (paymentTokenId: string): Promise<RevokePaymentTokenOutcome> => {
      const result = await revokePaymentToken(paymentTokenId);
      if (result.error || !result.data) {
        throw new Error(result.error ?? "Falha ao remover cartão");
      }
      return result.data;
    },
    onSuccess: (outcome) => {
      if (outcome.outcome === "revoked") {
        void queryClient.invalidateQueries({ queryKey: SAVED_PAYMENT_TOKENS_QUERY_KEY });
      }
    },
  });

  return {
    cards: tokensQuery.data ?? [],
    isLoading: tokensQuery.isLoading,
    isError: tokensQuery.isError,
    error: tokensQuery.error,
    refetch: tokensQuery.refetch,
    revokeCard: revokeMutation.mutateAsync,
    isRevoking: revokeMutation.isPending,
    revokingTokenId: revokeMutation.variables ?? null,
  };
}
