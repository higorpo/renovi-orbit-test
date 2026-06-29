import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  tokenizePaymentCard,
  type TokenizeCardRequest,
  type TokenizeCardSuccess,
} from "../api/cards.api";
import { SAVED_PAYMENT_TOKENS_QUERY_KEY } from "./useSavedPaymentTokens";

export function useTokenizeCard() {
  const queryClient = useQueryClient();

  return useMutation<TokenizeCardSuccess, Error, TokenizeCardRequest>({
    mutationFn: async (request) => {
      const result = await tokenizePaymentCard(request);
      if (result.error || !result.data) {
        throw new Error(result.error ?? "Falha ao tokenizar cartão");
      }
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SAVED_PAYMENT_TOKENS_QUERY_KEY });
    },
    gcTime: 0,
    staleTime: 0,
  });
}
