import { Loader2, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { useClientPaymentHistory } from "../../hooks/useClientPaymentHistory";
import { getClientPaymentHistoryAmounts } from "../../utils/clientPaymentHistoryAmounts";
import {
  formatPaymentHistoryDate,
  formatPaymentHistoryState,
} from "../../utils/formatPaymentHistoryState";
import { PaymentDisputeBadge } from "../PaymentDisputeBadge";

export function ClientPaymentHistoryList() {
  const historyQuery = useClientPaymentHistory();
  const transactions = historyQuery.data ?? [];

  if (historyQuery.isLoading) {
    return (
      <section className="rounded-xl border border-border p-6" aria-label="Histórico de pagamentos">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando histórico…
        </div>
      </section>
    );
  }

  if (historyQuery.isError) {
    return (
      <section className="rounded-xl border border-border p-6" aria-label="Histórico de pagamentos">
        <p className="text-sm text-destructive" role="alert">
          Não foi possível carregar o histórico de pagamentos.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border p-6 space-y-4" aria-label="Histórico de pagamentos">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Histórico de pagamentos</h2>
        <p className="text-sm text-muted-foreground">
          Pagamentos realizados no cartão, incluindo reembolsos quando aplicável.
        </p>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
      ) : (
        <ul className="space-y-3">
          {transactions.map((transaction) => {
            const amounts = getClientPaymentHistoryAmounts(transaction);

            return (
              <li
                key={transaction.scheduleId}
                className="flex items-start gap-3 rounded-xl border border-border p-4"
              >
                <Receipt className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="font-medium">
                    {amounts.showRefundBreakdown ? (
                      <>
                        <span className="text-muted-foreground line-through">
                          {formatCurrency(amounts.originalAmount)}
                        </span>
                        <span className="mx-1.5" aria-hidden>
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
                    <p className="text-muted-foreground">
                      {amounts.isRefundPending
                        ? `Reembolso em processamento: ${formatCurrency(amounts.refundedAmount)}`
                        : `Reembolsado: ${formatCurrency(amounts.refundedAmount)}`}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground">
                    Serviço: {formatCurrency(transaction.serviceAmount)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {formatPaymentHistoryDate(transaction.paidAt)} ·{" "}
                      {formatPaymentHistoryState(transaction.state)}
                    </span>
                    {transaction.isDisputed ? <PaymentDisputeBadge /> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
