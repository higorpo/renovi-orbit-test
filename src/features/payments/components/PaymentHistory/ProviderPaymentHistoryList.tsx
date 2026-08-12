import { Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useProviderPaymentHistory } from "../../hooks/useProviderPaymentHistory";
import {
  formatPaymentHistoryDate,
  formatPaymentHistoryState,
} from "../../utils/formatPaymentHistoryState";
import { PaymentDisputeBadge } from "../PaymentDisputeBadge";

function ProviderPaymentHistorySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando cobranças">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-[5.5rem] w-full rounded-2xl" />
      <Skeleton className="h-[5.5rem] w-full rounded-2xl" />
    </div>
  );
}

export type ProviderPaymentHistoryListProps = {
  receivedFrom?: string | null;
  receivedTo?: string | null;
};

export function ProviderPaymentHistoryList({
  receivedFrom,
  receivedTo,
}: ProviderPaymentHistoryListProps = {}) {
  const historyQuery = useProviderPaymentHistory({ receivedFrom, receivedTo });
  const receivables = historyQuery.data ?? [];

  if (historyQuery.isLoading) {
    return <ProviderPaymentHistorySkeleton />;
  }

  if (historyQuery.isError) {
    return (
      <div
        className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-5"
        aria-label="Histórico de cobranças"
      >
        <p className="text-sm text-destructive" role="alert">
          Não foi possível carregar o histórico de cobranças.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 rounded-full"
          onClick={() => void historyQuery.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-label="Histórico de cobranças">
      <p className="text-caption text-muted-foreground">
        {receivables.length === 0
          ? "Nenhum registrado"
          : receivables.length === 1
            ? "1 cobrança"
            : `${receivables.length} cobranças`}
      </p>

      {receivables.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-canvas-soft px-6 py-12 text-center">
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"
            aria-hidden
          >
            <Wallet className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <p className="font-display text-base font-semibold tracking-tight text-ink">
            Nenhuma cobrança neste período
          </p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-body">
            Quando um cliente pagar um serviço seu neste período, o valor combinado aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {receivables.map((receivable) => (
            <li key={receivable.scheduleId}>
              <article className="rounded-2xl border border-border bg-canvas p-4 shadow-sm sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
                    aria-hidden
                  >
                    <Wallet className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-display text-[15px] font-semibold tracking-tight text-ink">
                      {formatCurrency(receivable.amountReceivedAtCapture)}
                    </p>
                    {receivable.netAmountReceived !== receivable.amountReceivedAtCapture ? (
                      <p className="text-sm text-muted-foreground">
                        Líquido após estornos: {formatCurrency(receivable.netAmountReceived)}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                      <span>
                        {formatPaymentHistoryDate(receivable.receivedAt)} ·{" "}
                        {formatPaymentHistoryState(receivable.state)}
                      </span>
                      {receivable.isDisputed ? <PaymentDisputeBadge /> : null}
                    </div>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
