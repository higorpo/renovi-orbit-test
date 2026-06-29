import { useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchInstallmentOptions,
  type FetchInstallmentOptionsParams,
} from "../api/cards.api";

export const INSTALLMENT_OPTIONS_QUERY_KEY = ["installment-options"];

export function useInstallmentOptions(
  params: FetchInstallmentOptionsParams & { enabled?: boolean },
) {
  const { enabled = true, ...queryParams } = params;

  return useQuery({
    queryKey: [
      ...INSTALLMENT_OPTIONS_QUERY_KEY,
      queryParams.proposalId,
      queryParams.serviceId,
      queryParams.cardBrand,
    ],
    queryFn: async () => {
      const result = await fetchInstallmentOptions(queryParams);
      if (result.error || !result.data) {
        throw new Error(result.error ?? "installment_options_unavailable");
      }
      return result.data;
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useInstallmentSignatureRecovery(
  paymentTokenId: string | undefined,
  refetchInstallments: () => Promise<unknown>,
) {
  const paymentTokenRef = useRef(paymentTokenId);
  paymentTokenRef.current = paymentTokenId;

  const handleSignatureExpired = useCallback(async () => {
    await refetchInstallments();
    return paymentTokenRef.current;
  }, [refetchInstallments]);

  return {
    handleSignatureExpired,
    paymentTokenId: paymentTokenRef.current,
  };
}
