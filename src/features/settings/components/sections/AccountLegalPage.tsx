import { useAuth } from "@/features/auth";
import {
  PRIVACY_POLICY_URL,
  PROVIDER_PLATFORM_CONTRACT_URL,
  TERMS_OF_USE_URL,
} from "../../constants";
import { LegalDocumentsSection } from "../LegalDocumentsSection";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

export function AccountLegalPage() {
  const { profile } = useAuth();
  const isProvider = profile?.role === "provider";

  return (
    <SettingsSectionShell>
      <SettingsSectionHeader
        title="Jurídico"
        description="Documentos oficiais da Prestway"
      />
      <LegalDocumentsSection
        termsOfUseUrl={TERMS_OF_USE_URL}
        privacyPolicyUrl={PRIVACY_POLICY_URL}
        providerPlatformContractUrl={PROVIDER_PLATFORM_CONTRACT_URL}
        showProviderContract={isProvider}
      />
    </SettingsSectionShell>
  );
}
