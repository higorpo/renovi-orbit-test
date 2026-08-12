import { SavedCardsList, PaymentHistorySection } from "@/features/payments";
import { useAccountProfile } from "../../hooks/useAccountProfile";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

export function ClientPaymentsPage() {
  return (
    <SettingsRoleGate allow={["client"]}>
      <ClientPaymentsContent />
    </SettingsRoleGate>
  );
}

function ClientPaymentsContent() {
  const { profile, isLoading } = useAccountProfile();

  return (
    <SettingsSectionShell>
      <SettingsSectionHeader
        title="Pagamentos"
        description="Cartões salvos e histórico de cobranças"
      />
      {!isLoading ? (
        <SavedCardsList phone={profile?.phone ?? undefined} tokenizeContext="profile" />
      ) : null}
      <PaymentHistorySection role="client" />
    </SettingsSectionShell>
  );
}
