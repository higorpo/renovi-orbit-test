import { useQuery } from "@tanstack/react-query";
import { listProviderPaymentReceivables } from "../api/history.api";

export const PROVIDER_PAYMENT_HISTORY_QUERY_KEY = ["payment-history", "provider"] as const;

export type UseProviderPaymentHistoryParams = {
  receivedFrom?: string | null;
  receivedTo?: string | null;
  enabled?: boolean;
};

export function useProviderPaymentHistory(
  enabledOrParams: boolean | UseProviderPaymentHistoryParams = true,
) {
  const params =
    typeof enabledOrParams === "boolean"
      ? { enabled: enabledOrParams }
      : enabledOrParams;
  const receivedFrom = params.receivedFrom ?? null;
  const receivedTo = params.receivedTo ?? null;
  const enabled = params.enabled !== false;

  return useQuery({
    queryKey: [...PROVIDER_PAYMENT_HISTORY_QUERY_KEY, receivedFrom, receivedTo],
    queryFn: async () => {
      const result = await listProviderPaymentReceivables({ receivedFrom, receivedTo });
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled,
    staleTime: 30_000,
  });
}
