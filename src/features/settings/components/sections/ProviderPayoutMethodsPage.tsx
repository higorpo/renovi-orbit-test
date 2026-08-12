import {
  PROVIDER_KYC_HELP_MAILTO,
  PROVIDER_KYC_SUPPORT_URL,
} from "@/features/provider-kyc";
import { useProviderPayoutMethods } from "../../hooks/useProviderPayoutMethods";
import { AccountErrorState } from "../AccountErrorState";
import { PayoutMethodsFormSkeleton } from "../AccountFormSkeletons";
import { PayoutMethodsSection } from "../PayoutMethodsSection";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

export function ProviderPayoutMethodsPage() {
  return (
    <SettingsRoleGate allow={["provider"]}>
      <ProviderPayoutMethodsContent />
    </SettingsRoleGate>
  );
}

function ProviderPayoutMethodsContent() {
  const { bankLabel, bankBranch, bankAccount, pixKey, isLoading, error, refetch } =
    useProviderPayoutMethods();
  const supportHref = PROVIDER_KYC_SUPPORT_URL ?? PROVIDER_KYC_HELP_MAILTO;

  if (error && !isLoading) {
    return <AccountErrorState onRetry={refetch} />;
  }

  return (
    <SettingsSectionShell>
      <SettingsSectionHeader
        title="Dados bancários"
        description="Conta onde a Prestway deposita os seus ganhos"
      />

      {isLoading ? (
        <PayoutMethodsFormSkeleton />
      ) : (
        <PayoutMethodsSection
          bankLabel={bankLabel}
          bankBranch={bankBranch}
          bankAccount={bankAccount}
          pixKey={pixKey}
          supportHref={supportHref}
        />
      )}
    </SettingsSectionShell>
  );
}
