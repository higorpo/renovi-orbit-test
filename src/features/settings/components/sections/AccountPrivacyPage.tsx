import { PRIVACY_POLICY_URL } from "../../constants";
import { PrivacySection } from "../PrivacySection";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

export function AccountPrivacyPage() {
  return (
    <SettingsSectionShell>
      <SettingsSectionHeader
        title="Privacidade"
        description="Política e pedidos relacionados aos seus dados"
      />
      <PrivacySection privacyPolicyUrl={PRIVACY_POLICY_URL} />
    </SettingsSectionShell>
  );
}
