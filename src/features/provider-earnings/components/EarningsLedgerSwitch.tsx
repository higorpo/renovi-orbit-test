import { ArrowRight, Banknote, Landmark } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
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
  onViewChange?: (view: EarningsView) => void;
};

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
    return <Skeleton className="mt-2 h-8 w-36 rounded-md" />;
  }
  if (isError) {
    return <p className="mt-2 font-display text-lg font-semibold text-body">Indisponível</p>;
  }
  return (
    <p className="mt-2 font-display text-[1.65rem] font-bold leading-none tracking-tight text-ink tabular-nums sm:text-3xl">
      {children}
    </p>
  );
}

const panelClassName = (active: boolean) =>
  cn(
    "relative h-auto min-h-11 flex-col items-start gap-0 overflow-hidden whitespace-normal rounded-2xl border px-4 py-4 text-left shadow-none",
    "hover:bg-canvas hover:text-ink data-[state=active]:shadow-sm",
    active ? "border-ink/15 bg-canvas text-ink" : "border-border bg-canvas-soft text-body",
  );

export function EarningsLedgerSwitch({ view, summary, onViewChange }: EarningsLedgerSwitchProps) {
  const chargesActive = view === EARNINGS_VIEW.charges;
  const depositsActive = view === EARNINGS_VIEW.deposits;
  const depositLabel =
    summary.depositCount === 1 ? "1 depósito" : `${summary.depositCount} depósitos`;

  return (
    <div className="space-y-3">
      <div className="relative">
        <TabsList
          className={cn(
            "grid h-auto min-h-0 w-full grid-cols-1 gap-2 overflow-visible bg-transparent p-0",
            "sm:grid-cols-2 sm:gap-8",
          )}
          aria-label="Visões de ganhos"
        >
          <TabsTrigger
            value={EARNINGS_VIEW.charges}
            onClick={() => onViewChange?.(EARNINGS_VIEW.charges)}
            className={panelClassName(chargesActive)}
          >
            <span
              className={cn(
                "absolute left-0 top-0 h-full w-[3px] rounded-none",
                chargesActive ? "bg-accent" : "bg-transparent",
              )}
              aria-hidden
            />
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <Banknote className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
              Cobranças
            </span>
            <LedgerAmount
              isLoading={summary.isLoadingReceivables}
              isError={summary.isErrorReceivables}
            >
              {formatCurrency(summary.agreedTotal)}
            </LedgerAmount>
            <span className="mt-2 text-caption leading-snug text-body">
              Valor combinado com o cliente
            </span>
            {summary.hasClawback && !summary.isLoadingReceivables && !summary.isErrorReceivables ? (
              <span className="mt-1 text-caption text-muted-foreground">
                Líquido após estornos: {formatCurrency(summary.netTotal)}
              </span>
            ) : null}
          </TabsTrigger>

          <TabsTrigger
            value={EARNINGS_VIEW.deposits}
            onClick={() => onViewChange?.(EARNINGS_VIEW.deposits)}
            className={panelClassName(depositsActive)}
          >
            <span
              className={cn(
                "absolute left-0 top-0 h-full w-[3px] rounded-none",
                depositsActive ? "bg-accent" : "bg-transparent",
              )}
              aria-hidden
            />
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <Landmark className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
              Depósitos
            </span>
            <LedgerAmount
              isLoading={summary.isLoadingDeposits}
              isError={summary.isErrorDeposits}
            >
              {depositLabel}
            </LedgerAmount>
            <span className="mt-2 text-caption leading-snug text-body">
              O que cai na sua conta, em parcelas
            </span>
          </TabsTrigger>
        </TabsList>

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-canvas text-mute sm:flex"
          aria-hidden
        >
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>

      <p className="text-caption leading-relaxed text-body">
        O depósito costuma levar cerca de 30 dias após o pagamento e pode ser parcelado.{" "}
        {PROVIDER_SETTLEMENT_COMPLETION_NOTE}
      </p>
    </div>
  );
}
