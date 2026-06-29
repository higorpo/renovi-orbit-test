import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { fetchProviderPaymentAccount } from "../api/kyc.api";

export const PROVIDER_PAYMENT_ACCOUNT_QUERY_KEY = ["provider-payment-account"];

export function useProviderPaymentAccount(enabled = true) {
  const { user } = useAuth();
  const providerId = user?.id ?? null;

  return useQuery({
    queryKey: [...PROVIDER_PAYMENT_ACCOUNT_QUERY_KEY, providerId],
    queryFn: async () => {
      const result = await fetchProviderPaymentAccount(providerId!);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: enabled && Boolean(providerId),
    refetchInterval: (query) => {
      const account = query.state.data;
      if (account?.onboardingStatus === "DOCUMENTS_SUBMITTED" && !account.emailDispatchedAt) {
        return 5_000;
      }
      return false;
    },
    staleTime: 10_000,
  });
}
