import { PaymentHistorySection } from "@/features/payments";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

export function ProviderReceivablesPage() {
  return (
    <SettingsRoleGate allow={["provider"]}>
      <SettingsSectionShell>
        <SettingsSectionHeader
          title="Recebimentos"
          description="Valores capturados na plataforma (antes da liquidação bancária)"
        />
        <PaymentHistorySection role="provider" />
      </SettingsSectionShell>
    </SettingsRoleGate>
  );
}
