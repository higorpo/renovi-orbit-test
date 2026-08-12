import { Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useClientPaymentHistory } from "../../hooks/useClientPaymentHistory";
import { getClientPaymentHistoryAmounts } from "../../utils/clientPaymentHistoryAmounts";
import {
  formatPaymentHistoryDate,
  formatPaymentHistoryState,
} from "../../utils/formatPaymentHistoryState";
import { PaymentDisputeBadge } from "../PaymentDisputeBadge";

function ClientPaymentHistorySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando histórico">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-[5.5rem] w-full rounded-2xl" />
      <Skeleton className="h-[5.5rem] w-full rounded-2xl" />
      <Skeleton className="h-[5.5rem] w-full rounded-2xl" />
    </div>
  );
}

export function ClientPaymentHistoryList() {
  const historyQuery = useClientPaymentHistory();
  const transactions = historyQuery.data ?? [];

  if (historyQuery.isLoading) {
    return <ClientPaymentHistorySkeleton />;
  }

  if (historyQuery.isError) {
    return (
      <div
        className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-5"
        aria-label="Histórico de pagamentos"
      >
        <p className="text-sm text-destructive" role="alert">
          Não foi possível carregar o histórico de pagamentos.
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
    <div className="space-y-4" aria-label="Histórico de pagamentos">
      <p className="text-caption text-muted-foreground">
        {transactions.length === 0
          ? "Nenhum registrado"
          : transactions.length === 1
            ? "1 pagamento"
            : `${transactions.length} pagamentos`}
      </p>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-canvas-soft px-6 py-12 text-center">
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"
            aria-hidden
          >
            <Receipt className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <p className="font-display text-base font-semibold tracking-tight text-ink">
            Nenhum pagamento ainda
          </p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-body">
            Quando você pagar um serviço, o registro aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {transactions.map((transaction) => {
            const amounts = getClientPaymentHistoryAmounts(transaction);

            return (
              <li key={transaction.scheduleId}>
                <article className="rounded-2xl border border-border bg-canvas p-4 shadow-sm sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
                      aria-hidden
                    >
                      <Receipt className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-display text-[15px] font-semibold tracking-tight text-ink">
                        {amounts.showRefundBreakdown ? (
                          <>
                            <span className="text-muted-foreground line-through">
                              {formatCurrency(amounts.originalAmount)}
                            </span>
                            <span className="mx-1.5 font-normal text-muted-foreground" aria-hidden>
                              →
                            </span>
                            <span>{formatCurrency(amounts.netAmount)}</span>
                          </>
                        ) : (
                          formatCurrency(amounts.originalAmount)
                        )}
                        {transaction.installmentNumber > 1
                          ? ` · ${transaction.installmentNumber}x`
                          : null}
                      </p>
                      {amounts.showRefundBreakdown && amounts.refundedAmount != null ? (
                        <p className="text-sm text-body">
                          {amounts.isRefundPending
                            ? `Reembolso em processamento: ${formatCurrency(amounts.refundedAmount)}`
                            : `Reembolsado: ${formatCurrency(amounts.refundedAmount)}`}
                        </p>
                      ) : null}
                      <p className="text-sm text-muted-foreground">
                        Serviço: {formatCurrency(transaction.serviceAmount)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                        <span>
                          {formatPaymentHistoryDate(transaction.paidAt)} ·{" "}
                          {formatPaymentHistoryState(transaction.state)}
                        </span>
                        {transaction.isDisputed ? <PaymentDisputeBadge /> : null}
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
