import { SavedCardsList, PaymentHistorySection } from "@/features/payments";
import { useAccountProfile } from "../../hooks/useAccountProfile";
import { AccountRoleGate } from "../AccountRoleGate";
import { AccountSectionHeader } from "../AccountSectionHeader";

export function ClientPaymentsPage() {
  return (
    <AccountRoleGate allow={["client"]}>
      <ClientPaymentsContent />
    </AccountRoleGate>
  );
}

function ClientPaymentsContent() {
  const { profile, isLoading } = useAccountProfile();

  return (
    <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
      <AccountSectionHeader
        title="Pagamentos"
        description="Cartões salvos e histórico de cobranças"
      />
      {!isLoading ? (
        <SavedCardsList phone={profile?.phone ?? undefined} tokenizeContext="profile" />
      ) : null}
      <PaymentHistorySection role="client" />
    </div>
  );
}
