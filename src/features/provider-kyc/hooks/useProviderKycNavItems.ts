import { useAuth } from "@/features/auth";
import { shouldBlockProviderForKyc } from "../api/kyc.api";
import { PROVIDER_KYC_ALLOWED_PATH_PREFIX } from "../constants/kyc.constants";
import { useProviderPaymentAccount } from "./useProviderPaymentAccount";

/**
 * When a provider is not ACTIVE, nav is limited to Minha conta (logout lives there).
 */
export function useProviderKycNavItems<T extends { path: string }>(
  allItems: T[],
  mainItems: T[],
): { allItems: T[]; mainItems: T[] } {
  const { profile } = useAuth();
  const isProvider = profile?.role === "provider";
  const accountQuery = useProviderPaymentAccount(isProvider);

  const blocked =
    isProvider
    && (accountQuery.isLoading || shouldBlockProviderForKyc(accountQuery.data ?? null));

  if (!blocked) {
    return { allItems, mainItems };
  }

  const contaOnly = allItems.filter((item) => item.path === PROVIDER_KYC_ALLOWED_PATH_PREFIX);
  return { allItems: contaOnly, mainItems: contaOnly };
}
