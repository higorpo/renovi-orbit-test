import { DangerZoneSection } from "../DangerZoneSection";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

export function AccountSessionPage() {
  return (
    <SettingsSectionShell>
      <SettingsSectionHeader
        title="Conta"
        description="Exclusão permanente da sua conta"
      />
      <DangerZoneSection />
    </SettingsSectionShell>
  );
}
