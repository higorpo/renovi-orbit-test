import { AddressesSection } from "@/features/addresses";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

export function ClientAddressesPage() {
  return (
    <SettingsRoleGate allow={["client"]}>
      <SettingsSectionShell>
        <SettingsSectionHeader
          title="Endereços"
          description="Locais onde os serviços podem ser realizados"
        />
        <AddressesSection />
      </SettingsSectionShell>
    </SettingsRoleGate>
  );
}
