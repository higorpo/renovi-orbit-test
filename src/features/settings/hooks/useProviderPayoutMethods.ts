import {
  findBrazilianBankByCode,
  formatBankLabel,
  useBrazilianBanks,
} from "@/features/provider-kyc";
import { useProviderProfile } from "./useProviderProfile";

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function useProviderPayoutMethods() {
  const { privateData, isLoading, error, refetch } = useProviderProfile();
  const banksQuery = useBrazilianBanks();
  const code = emptyToNull(privateData?.bank_institution_code);
  const bank = code ? findBrazilianBankByCode(code, banksQuery.data ?? []) : undefined;

  const bankBranch = emptyToNull(privateData?.bank_branch);
  const bankAccount = emptyToNull(privateData?.bank_account);
  const pixKey = emptyToNull(privateData?.pix_key);

  return {
    bankLabel: bank ? formatBankLabel(bank) : code,
    bankBranch,
    bankAccount,
    pixKey,
    hasBankDetails: Boolean(code || bankBranch || bankAccount || pixKey),
    isLoading: isLoading || banksQuery.isLoading,
    error,
    refetch,
  };
}
