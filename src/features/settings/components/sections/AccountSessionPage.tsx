import { LogoutSection } from "../LogoutSection";
import { DangerZoneSection } from "../DangerZoneSection";
import { SettingsSectionHeader } from "../SettingsSectionHeader";

export function AccountSessionPage() {
  return (
    <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
      <SettingsSectionHeader
        title="Conta"
        description="Sessão e exclusão de conta"
      />
      <LogoutSection />
      <DangerZoneSection />
    </div>
  );
}
