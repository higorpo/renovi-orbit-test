import { FileText, MessageCircleQuestion, Search } from "lucide-react";
import type { BudgetsTab } from "../types/provider-budgets.types";

export interface BudgetsEmptyStateProps {
  tab: BudgetsTab;
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function BudgetsEmptyState({
  tab,
  hasFilters,
  onClearFilters,
}: BudgetsEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Search className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-semibold">
          Nenhum resultado encontrado
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Tente ajustar os filtros ou a busca para encontrar o que procura.
        </p>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>
    );
  }

  if (tab === "enviados") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileText className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-semibold">
          Você ainda não enviou nenhum orçamento
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Quando você enviar orçamentos para pedidos de serviço, eles aparecerão
          aqui para você acompanhar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <MessageCircleQuestion
          className="h-6 w-6 text-muted-foreground"
          aria-hidden
        />
      </div>
      <h3 className="mt-4 text-base font-semibold">
        Você ainda não enviou nenhuma pergunta
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Quando você fizer perguntas sobre pedidos de serviço, elas aparecerão
        aqui para você acompanhar as respostas.
      </p>
    </div>
  );
}
