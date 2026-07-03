import { Loader2, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { useProviderPaymentHistory } from "../../hooks/useProviderPaymentHistory";
import {
  formatPaymentHistoryDate,
  formatPaymentHistoryState,
} from "../../utils/formatPaymentHistoryState";
import { PaymentDisputeBadge } from "../PaymentDisputeBadge";
import { ProviderSettlementDisclosure } from "../ProviderSettlementDisclosure";
import { PROVIDER_SETTLEMENT_COMPLETION_NOTE } from "../../utils/providerSettlementDisclosure";

export function ProviderPaymentHistoryList() {
  const historyQuery = useProviderPaymentHistory();
  const receivables = historyQuery.data ?? [];

  if (historyQuery.isLoading) {
    return (
      <section className="rounded-xl border border-border p-6" aria-label="Histórico de recebimentos">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando recebimentos…
        </div>
      </section>
    );
  }

  if (historyQuery.isError) {
    return (
      <section className="rounded-xl border border-border p-6" aria-label="Histórico de recebimentos">
        <p className="text-sm text-destructive" role="alert">
          Não foi possível carregar o histórico de recebimentos.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border p-6 space-y-4" aria-label="Histórico de recebimentos">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Recebimentos</h2>
        <p className="text-sm text-muted-foreground">
          Valores pagos pelo cliente na plataforma. O depósito na sua conta costuma levar cerca de 30 dias após a
          confirmação do pagamento. {PROVIDER_SETTLEMENT_COMPLETION_NOTE}
        </p>
      </div>

      {receivables.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum recebimento registrado ainda.</p>
      ) : (
        <ul className="space-y-3">
          {receivables.map((receivable) => (
            <li
              key={receivable.scheduleId}
              className="flex items-start gap-3 rounded-xl border border-border p-4"
            >
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="font-medium">
                  {formatCurrency(receivable.netAmountReceived)}
                </p>
                {receivable.netAmountReceived !== receivable.amountReceivedAtCapture ? (
                  <p className="text-muted-foreground">
                    Valor original: {formatCurrency(receivable.amountReceivedAtCapture)}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {formatPaymentHistoryDate(receivable.receivedAt)} ·{" "}
                    {formatPaymentHistoryState(receivable.state)}
                  </span>
                  {receivable.isDisputed ? <PaymentDisputeBadge /> : null}
                </div>
                <ProviderSettlementDisclosure capturePaidAt={receivable.receivedAt} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
