import {
  PROVIDER_KYC_HELP_MAILTO,
  PROVIDER_KYC_SUPPORT_URL,
} from "@/features/provider-kyc";
import { useProviderKycDocuments } from "../../hooks/useProviderKycDocuments";
import { AccountErrorState } from "../AccountErrorState";
import { KycDocumentsFormSkeleton } from "../AccountFormSkeletons";
import { KycDocumentsSection } from "../KycDocumentsSection";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

export function ProviderKycDocumentsPage() {
  return (
    <SettingsRoleGate allow={["provider"]}>
      <ProviderKycDocumentsContent />
    </SettingsRoleGate>
  );
}

function ProviderKycDocumentsContent() {
  const { documents, downloadingKey, downloadDocument, isLoading, error, refetch } =
    useProviderKycDocuments();
  const supportHref = PROVIDER_KYC_SUPPORT_URL ?? PROVIDER_KYC_HELP_MAILTO;

  if (error && !isLoading) {
    return <AccountErrorState onRetry={refetch} />;
  }

  return (
    <SettingsSectionShell>
      <SettingsSectionHeader
        title="Documentos"
        description="Arquivos enviados na verificação da conta"
      />

      {isLoading ? (
        <KycDocumentsFormSkeleton />
      ) : (
        <KycDocumentsSection
          documents={documents}
          downloadingKey={downloadingKey}
          onDownload={downloadDocument}
          supportHref={supportHref}
        />
      )}
    </SettingsSectionShell>
  );
}
