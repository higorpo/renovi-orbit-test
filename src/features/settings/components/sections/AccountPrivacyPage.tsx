import { PRIVACY_POLICY_URL } from "../../constants";
import { PrivacySection } from "../PrivacySection";
import { SettingsSectionHeader } from "../SettingsSectionHeader";

export function AccountPrivacyPage() {
  return (
    <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
      <SettingsSectionHeader
        title="Privacidade"
        description="Política e pedidos relacionados aos seus dados"
      />
      <PrivacySection privacyPolicyUrl={PRIVACY_POLICY_URL} />
    </div>
  );
}
