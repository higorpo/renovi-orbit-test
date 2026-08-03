import { useAuth } from "@/features/auth";
import { shouldBlockProviderForKyc } from "../api/kyc.api";
import { useProviderPaymentAccount } from "./useProviderPaymentAccount";

/**
 * True while a provider must finish KYC — dashboard chrome should hide navigation.
 * Includes account loading so menus do not flash before the gate resolves.
 */
export function useProviderKycBlocksNav(): boolean {
  const { profile } = useAuth();
  const isProvider = profile?.role === "provider";
  const accountQuery = useProviderPaymentAccount(isProvider);

  return (
    isProvider
    && (accountQuery.isLoading || shouldBlockProviderForKyc(accountQuery.data ?? null))
  );
}
