import { LogoutSection } from "../LogoutSection";
import { DangerZoneSection } from "../DangerZoneSection";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

export function AccountSessionPage() {
  return (
    <SettingsSectionShell>
      <SettingsSectionHeader
        title="Conta"
        description="Sessão e exclusão de conta"
      />
      <LogoutSection />
      <DangerZoneSection />
    </SettingsSectionShell>
  );
}
