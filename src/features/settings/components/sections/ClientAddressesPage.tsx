import { AddressesSection } from "@/features/addresses";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";

export function ClientAddressesPage() {
  return (
    <SettingsRoleGate allow={["client"]}>
      <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
        <SettingsSectionHeader
          title="Endereços"
          description="Locais onde os serviços podem ser realizados"
        />
        <AddressesSection />
      </div>
    </SettingsRoleGate>
  );
}
