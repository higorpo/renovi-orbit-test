import { EarningsPage } from "@/features/provider-earnings/components/EarningsPage";
import { AccountRoleGate } from "../AccountRoleGate";
import { AccountSectionHeader } from "../AccountSectionHeader";

/** Hosts provider-earnings UI inside the account hub. */
export function ProviderEarningsSectionPage() {
  return (
    <AccountRoleGate allow={["provider"]}>
      <div className="md:py-0">
        <div className="px-4 md:px-0">
          <AccountSectionHeader
            title="Ganhos"
            description="Liquidações previstas e depositadas na sua conta bancária"
          />
        </div>
        <div className="[&_.container]:max-w-none [&_.container]:px-4 [&_.container]:py-0 md:[&_.container]:px-0 [&_header]:hidden">
          <EarningsPage />
        </div>
      </div>
    </AccountRoleGate>
  );
}
