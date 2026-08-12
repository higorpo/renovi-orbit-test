import { useState } from "react";
import { CreditCard, Receipt } from "lucide-react";
import { SavedCardsList, PaymentHistorySection } from "@/features/payments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAccountProfile } from "../../hooks/useAccountProfile";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

type PaymentsTab = "methods" | "history";

export function ClientPaymentsPage() {
  return (
    <SettingsRoleGate allow={["client"]}>
      <ClientPaymentsContent />
    </SettingsRoleGate>
  );
}

function ClientPaymentsContent() {
  const { profile } = useAccountProfile();
  const [tab, setTab] = useState<PaymentsTab>("methods");

  return (
    <SettingsSectionShell>
      <SettingsSectionHeader
        title="Pagamentos"
        description="Cartões salvos e histórico de cobranças"
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as PaymentsTab)}
        className="w-full"
      >
        <TabsList
          className={cn(
            "grid w-full grid-cols-2 gap-1 rounded-xl bg-canvas-soft p-1",
            "min-h-0 overflow-visible",
          )}
          aria-label="Seções de pagamentos"
        >
          <TabsTrigger
            value="methods"
            className={cn(
              "h-10 gap-2 rounded-lg px-3 text-sm font-medium",
              "data-[state=active]:bg-canvas data-[state=active]:text-ink data-[state=active]:shadow-sm",
            )}
          >
            <CreditCard className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="truncate">Formas de pagamento</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className={cn(
              "h-10 gap-2 rounded-lg px-3 text-sm font-medium",
              "data-[state=active]:bg-canvas data-[state=active]:text-ink data-[state=active]:shadow-sm",
            )}
          >
            <Receipt className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="truncate">Histórico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="methods" className="mt-5 focus-visible:ring-0">
          <SavedCardsList phone={profile?.phone ?? undefined} tokenizeContext="profile" />
        </TabsContent>

        <TabsContent value="history" className="mt-5 focus-visible:ring-0">
          <PaymentHistorySection role="client" />
        </TabsContent>
      </Tabs>
    </SettingsSectionShell>
  );
}
