import { AddressesSection } from "@/features/addresses";
import { AccountRoleGate } from "../AccountRoleGate";
import { AccountSectionHeader } from "../AccountSectionHeader";

export function ClientAddressesPage() {
  return (
    <AccountRoleGate allow={["client"]}>
      <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
        <AccountSectionHeader
          title="Endereços"
          description="Locais onde os serviços podem ser realizados"
        />
        <AddressesSection />
      </div>
    </AccountRoleGate>
  );
}
