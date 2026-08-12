import { LogoutSection } from "../LogoutSection";
import { DangerZoneSection } from "../DangerZoneSection";
import { AccountSectionHeader } from "../AccountSectionHeader";

export function AccountSessionPage() {
  return (
    <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
      <AccountSectionHeader
        title="Conta"
        description="Sessão e exclusão de conta"
      />
      <LogoutSection />
      <DangerZoneSection />
    </div>
  );
}
