import { Banknote, Landmark } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import {
  EARNINGS_PERIOD_TABS,
  type EarningsPeriod,
} from "../constants/earningsPeriod";
import { EARNINGS_VIEW, type EarningsView } from "../constants/earningsView";
import { PROVIDER_SETTLEMENT_COMPLETION_NOTE } from "../utils/providerSettlementDisclosure";

export type EarningsLedgerSummary = {
  agreedTotal: number;
  netTotal: number;
  hasClawback: boolean;
  depositCount: number;
  isLoadingReceivables: boolean;
  isLoadingDeposits: boolean;
  isErrorReceivables: boolean;
  isErrorDeposits: boolean;
};

export type EarningsLedgerSwitchProps = {
  view: EarningsView;
  summary: EarningsLedgerSummary;
  period: EarningsPeriod;
  onViewChange?: (view: EarningsView) => void;
  onPeriodChange?: (period: EarningsPeriod) => void;
};

const ledgerTabClassName = cn(
  "flex min-h-11 w-full min-w-0 flex-col items-start justify-start gap-0",
  "whitespace-normal rounded-lg px-3 py-3 text-left text-sm font-medium",
  "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "data-[state=active]:bg-canvas-soft data-[state=active]:text-ink",
  "md:data-[state=active]:bg-canvas md:data-[state=active]:shadow-sm",
  "data-[state=inactive]:text-body",
);

function LedgerIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-audience-soft text-audience"
      aria-hidden
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}

function LedgerAmount({
  isLoading,
  isError,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  children: string;
}) {
  if (isLoading) {
    return <Skeleton className="mt-2 h-7 w-28 rounded-md" />;
  }
  if (isError) {
    return <p className="mt-2 font-display text-base font-semibold text-body">Indisponível</p>;
  }
  return (
    <p className="mt-2 font-display text-xl font-bold leading-none tracking-tight text-ink tabular-nums sm:text-2xl">
      {children}
    </p>
  );
}

export function EarningsLedgerSwitch({
  view,
  summary,
  period,
  onViewChange,
  onPeriodChange,
}: EarningsLedgerSwitchProps) {
  const depositLabel =
    summary.depositCount === 1 ? "1 depósito" : `${summary.depositCount} depósitos`;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-canvas p-1 md:bg-canvas-soft">
        <div
          className="grid grid-cols-3 gap-1"
          role="group"
          aria-label="Período dos ganhos"
        >
          {EARNINGS_PERIOD_TABS.map((tab) => {
            const isActive = period === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onPeriodChange?.(tab.id)}
                className={cn(
                  "h-11 rounded-lg px-2 text-sm font-medium transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "bg-canvas-soft text-ink md:bg-canvas md:shadow-sm"
                    : "text-body hover:text-ink",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <TabsPrimitive.List
          className="mt-1 grid w-full grid-cols-2 items-stretch gap-1"
          aria-label="Listas de ganhos"
        >
          <TabsPrimitive.Trigger
            value={EARNINGS_VIEW.charges}
            onClick={() => onViewChange?.(EARNINGS_VIEW.charges)}
            className={ledgerTabClassName}
          >
            <span className="flex items-center gap-2">
              <LedgerIcon icon={Banknote} />
              <span className="text-sm font-medium">Cobranças</span>
            </span>
            <LedgerAmount
              isLoading={summary.isLoadingReceivables}
              isError={summary.isErrorReceivables}
            >
              {formatCurrency(summary.agreedTotal)}
            </LedgerAmount>
            <span className="mt-1.5 text-caption leading-snug">Valor combinado</span>
            {summary.hasClawback && !summary.isLoadingReceivables && !summary.isErrorReceivables ? (
              <span className="mt-1 text-caption text-muted-foreground">
                Líquido após estornos: {formatCurrency(summary.netTotal)}
              </span>
            ) : null}
          </TabsPrimitive.Trigger>

          <TabsPrimitive.Trigger
            value={EARNINGS_VIEW.deposits}
            onClick={() => onViewChange?.(EARNINGS_VIEW.deposits)}
            className={ledgerTabClassName}
          >
            <span className="flex items-center gap-2">
              <LedgerIcon icon={Landmark} />
              <span className="text-sm font-medium">Depósitos</span>
            </span>
            <LedgerAmount
              isLoading={summary.isLoadingDeposits}
              isError={summary.isErrorDeposits}
            >
              {depositLabel}
            </LedgerAmount>
            <span className="mt-1.5 text-caption leading-snug">Na sua conta</span>
          </TabsPrimitive.Trigger>
        </TabsPrimitive.List>
      </div>

      <p className="text-caption leading-relaxed text-body">
        O depósito costuma levar cerca de 30 dias após o pagamento e pode ser parcelado.{" "}
        {PROVIDER_SETTLEMENT_COMPLETION_NOTE}
      </p>
    </div>
  );
}
