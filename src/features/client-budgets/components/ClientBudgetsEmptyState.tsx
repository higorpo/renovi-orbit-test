import { MessageCircleQuestion, ReceiptText, Search } from "lucide-react";
import type { ClientBudgetsTab } from "../types/client-budgets.types";

interface ClientBudgetsEmptyStateProps {
  tab: ClientBudgetsTab;
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function ClientBudgetsEmptyState({
  tab,
  hasFilters,
  onClearFilters,
}: ClientBudgetsEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Search className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-semibold">Nenhum resultado encontrado</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Tente ajustar os filtros ou a busca para encontrar o que procura.
        </p>
        {onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
    );
  }

  if (tab === "recebidos") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <ReceiptText className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-semibold">Nenhum orçamento recebido ainda</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Quando prestadores enviarem orçamentos para seus pedidos, eles aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <MessageCircleQuestion className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold">Nenhuma pergunta recebida ainda</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Perguntas enviadas por prestadores sobre seus pedidos aparecerão aqui para resposta.
      </p>
    </div>
  );
}
