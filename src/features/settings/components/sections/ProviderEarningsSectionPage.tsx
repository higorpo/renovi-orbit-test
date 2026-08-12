import { EarningsPage } from "@/features/provider-earnings/components/EarningsPage";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";

/** Hosts provider-earnings UI inside the account hub. */
export function ProviderEarningsSectionPage() {
  return (
    <SettingsRoleGate allow={["provider"]}>
      <div className="md:py-0">
        <div className="px-4 md:px-0">
          <SettingsSectionHeader
            title="Ganhos"
            description="Liquidações previstas e depositadas na sua conta bancária"
          />
        </div>
        <div className="[&_.container]:max-w-none [&_.container]:px-4 [&_.container]:py-0 md:[&_.container]:px-0 [&_header]:hidden">
          <EarningsPage />
        </div>
      </div>
    </SettingsRoleGate>
  );
}
