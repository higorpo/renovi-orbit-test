import { SavedCardsList, PaymentHistorySection } from "@/features/payments";
import { useAccountProfile } from "../../hooks/useAccountProfile";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";

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
    <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
      <SettingsSectionHeader
        title="Pagamentos"
        description="Cartões salvos e histórico de cobranças"
      />
      {!isLoading ? (
        <SavedCardsList phone={profile?.phone ?? undefined} tokenizeContext="profile" />
      ) : null}
      <PaymentHistorySection role="client" />
    </div>
  );
}
