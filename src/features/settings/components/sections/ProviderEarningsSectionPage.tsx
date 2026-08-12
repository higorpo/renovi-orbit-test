import { PaymentHistorySection } from "@/features/payments";
import {
  EarningsLedgerSwitch,
  EarningsPage,
  getEarningsPeriodRange,
  parseEarningsView,
  useEarningsViewParam,
} from "@/features/provider-earnings";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useEarningsLedgerSummary } from "../../hooks/useEarningsLedgerSummary";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell } from "../SettingsSectionShell";

/** Unified Ganhos hub: capture totals (Cobranças) + bank settlements (Depósitos). */
export function ProviderEarningsSectionPage() {
  return (
    <SettingsRoleGate allow={["provider"]}>
      <ProviderEarningsContent />
    </SettingsRoleGate>
  );
}

function ProviderEarningsContent() {
  const { view, setView, period, setPeriod } = useEarningsViewParam();
  const range = getEarningsPeriodRange(period);
  const summary = useEarningsLedgerSummary({
    receivedFrom: range.from,
    receivedTo: range.to,
    settlingFrom: range.from,
    settlingTo: range.to,
  });

  return (
    <SettingsSectionShell className="gap-4 md:gap-5">
      <SettingsSectionHeader
        title="Ganhos"
        description="O valor combinado com o cliente e o que cai na sua conta"
      />

      <Tabs
        value={view}
        onValueChange={(value) => setView(parseEarningsView(value))}
        className="w-full"
      >
        <EarningsLedgerSwitch
          view={view}
          summary={summary}
          period={period}
          onViewChange={setView}
          onPeriodChange={setPeriod}
        />

        <TabsContent value="deposits" className="mt-5 focus-visible:ring-0">
          <EarningsPage settlingFrom={range.from} settlingTo={range.to} />
        </TabsContent>
        <TabsContent value="charges" className="mt-5 focus-visible:ring-0">
          <PaymentHistorySection
            role="provider"
            receivedFrom={range.from}
            receivedTo={range.to}
          />
        </TabsContent>
      </Tabs>
    </SettingsSectionShell>
  );
}
