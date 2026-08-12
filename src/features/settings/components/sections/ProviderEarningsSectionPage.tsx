import { EarningsPage } from "@/features/provider-earnings/components/EarningsPage";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

/** Hosts provider-earnings UI inside the settings hub. */
export function ProviderEarningsSectionPage() {
  return (
    <SettingsRoleGate allow={["provider"]}>
      <SettingsSectionShell className="space-y-4 md:space-y-5">
        <SettingsSectionHeader
          title="Ganhos"
          description="Liquidações previstas e depositadas na sua conta bancária"
        />
        <div className="[&_.container]:max-w-none [&_.container]:px-0 [&_.container]:py-0 [&_header]:hidden">
          <EarningsPage />
        </div>
      </SettingsSectionShell>
    </SettingsRoleGate>
  );
}
