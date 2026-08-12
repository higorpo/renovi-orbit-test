import { PaymentHistorySection } from "@/features/payments";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";

export function ProviderReceivablesPage() {
  return (
    <SettingsRoleGate allow={["provider"]}>
      <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
        <SettingsSectionHeader
          title="Recebimentos"
          description="Valores capturados na plataforma (antes da liquidação bancária)"
        />
        <PaymentHistorySection role="provider" />
      </div>
    </SettingsRoleGate>
  );
}
